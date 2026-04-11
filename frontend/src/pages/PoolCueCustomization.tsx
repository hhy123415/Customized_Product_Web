/**
 * 碳纤维台球杆参数化定制组件
 * 
 * 核心功能：
 * 1. 基于 Three.js 的 3D 模型实时渲染与参数化变形
 * 2. 支持长度、重量、皮头直径、材质、涂装等维度的定制
 * 3. 实时价格计算与展示
 * 4. GLB 模型动态加载与材质隔离处理
 * 
 * 技术架构：
 * - React Hooks 管理组件状态与生命周期
 * - Three.js + GLTFLoader 处理 3D 渲染
 * - CSS Modules 实现样式隔离
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import styles from "../css/PoolCueCustomization.module.css";

// ==================== 类型定义区 ====================

/** 接牙材质类型：不锈钢（基础款）或钛合金（高端款） */
type JointType = "stainless-steel" | "titanium";

/** 握把类型：碳纤维防滑 / 真皮 / 无缠把 */
type WrapType = "carbon-grip" | "genuine-leather" | "none";

/** 球杆盒选项：无 / 基础软包 / 专业硬壳 */
type CaseOption = "none" | "basic" | "pro";

/** 
 * 涂装风格枚举
 * - matte-carbon/gloss-carbon: 碳纤基础款
 * - stealth-black: 哑光黑
 * - ice-silver/ocean-blue/crimson-red: 彩色涂装
 */
type FinishStyle =
  | "matte-carbon"
  | "gloss-carbon"
  | "stealth-black"
  | "ice-silver"
  | "ocean-blue"
  | "crimson-red";

/** 球杆完整配置接口 */
interface CueConfig {
  lengthCm: number;          // 杆体长度（厘米），标准147cm
  weightOz: number;          // 重量（盎司），范围17-21oz
  tipDiameterMm: number;    // 皮头直径（毫米），影响击球精度
  jointType: JointType;      // 接牙材质
  wrapType: WrapType;        // 握把类型
  finishStyle: FinishStyle;    // 表面涂装风格
  caseOption: CaseOption;    // 配套球杆盒
  includeLaserEngraving: boolean;  // 是否添加激光刻字
}

/** 价格明细项，用于展示分项计价 */
interface PriceLine {
  label: string;   // 项目描述
  amount: number;  // 金额（人民币）
}

/** 
 * GLB 模型源配置
 * 定义模型文件路径、轴向映射及基础变换参数
 */
interface CueModelSource {
  url: string;                          // public 目录下的模型相对路径
  lengthAxis: "x" | "y" | "z";         // 模型长度所在的轴向（用于参数化拉伸）
  baseRotation: [number, number, number];  // 模型基础旋转（弧度）
  baseScale: number;                   // 基础缩放系数
}

/**
 * 球杆部件映射结构
 * 通过精确命名匹配 GLB 模型中的子网格，实现分部件材质控制
 */
interface CueModelParts {
  root: THREE.Object3D;    // 模型根节点
  tip?: THREE.Object3D;      // 皮头（击球接触面）
  ferrule?: THREE.Object3D;  // 先角（皮头与杆身连接件）
  shaft?: THREE.Object3D;    // 前节（杆身主体）
  joint?: THREE.Object3D;    // 接牙（前后节连接处）
  grip?: THREE.Object3D;     // 握把（手部握持区）
  butt?: THREE.Object3D;     // 后把（杆尾配重区）
}

/** 模型材质诊断信息，用于调试和质量检查 */
interface ModelDiagnostic {
  meshCount: number;               // 网格总数
  materialCount: number;           // 独立材质数量
  texturedMaterialCount: number;     // 带贴图的材质数
  missingMaterialMeshCount: number;  // 缺失材质的网格数（已自动修复）
}

// ==================== 常量配置区 ====================

/** 
 * 模型源配置
 * 要求 GLB 模型：
 * 1. 单位为米，球杆长度约 1.47m
 * 2. 子网格命名包含 tip/ferrule/shaft/joint/grip/butt
 * 3. 导出时勾选"嵌入材质和纹理"
 */
const MODEL_SOURCE: CueModelSource = {
  url: "/models/cue-carbon.glb",   //pool-cue-carbon.glb
  lengthAxis: "y",                      // 模型长度沿 Y 轴
  baseRotation: [0, 0, -Math.PI / 2],   // 水平放置（绕 Z 轴旋转-90度）
  baseScale: 1,
};

/** 默认配置：147cm标准杆，19oz标准重量，海洋蓝涂装 */
const INITIAL_CONFIG: CueConfig = {
  lengthCm: 147,
  weightOz: 19,
  tipDiameterMm: 11,
  jointType: "stainless-steel",
  wrapType: "carbon-grip",
  finishStyle: "ocean-blue",
  caseOption: "basic",
  includeLaserEngraving: false,
};

/** 人民币格式化器，用于价格展示 */
const CURRENCY = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
  minimumFractionDigits: 0,
});

// ==================== 工具函数区 ====================

/**
 * 在模型层级中精确查找指定名称的节点
 * 采用大小写不敏感匹配，提高兼容性
 * @param root - 开始搜索的根节点
 * @param name - 目标节点名称
 * @returns 匹配到的节点，未找到返回 undefined
 */
function findNodeByExactName(root: THREE.Object3D, name: string) {
  let result: THREE.Object3D | undefined;
  root.traverse((node) => {
    if (result) return;  // 已找到则提前退出
    if (node.name.toLowerCase() === name.toLowerCase()) {
      result = node;
    }
  });
  return result;
}

/**
 * 批量设置部件材质属性
 * 遍历部件下所有 Mesh，修改其材质的颜色、粗糙度、金属度
 * 支持 MeshStandardMaterial 及其子类（如 MeshPhysicalMaterial）
 * 
 * @param part - 目标部件节点
 * @param color - CSS 颜色字符串（如 "#ff0000"）
 * @param roughness - 粗糙度（0-1），可选
 * @param metalness - 金属度（0-1），可选
 */
function setPartMaterialColor(
  part: THREE.Object3D | undefined,
  color: string,
  roughness?: number,
  metalness?: number
) {
  if (!part) return;

  part.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    // 处理多材质情况（如 group.material 为数组）
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    materials.forEach((material) => {
      if (material instanceof THREE.MeshStandardMaterial) {
        material.color.set(color);
        if (typeof roughness === "number") material.roughness = roughness;
        if (typeof metalness === "number") material.metalness = metalness;
        material.needsUpdate = true;  // 标记材质需要更新
      }
    });
  });
}

/**
 * 沿指定轴向设置缩放
 * 先重置为 1，再单独设置目标轴向的缩放值
 * 用于实现长度参数化（杆身拉伸）
 */
function setScaleByAxis(target: THREE.Object3D, axis: CueModelSource["lengthAxis"], value: number) {
  target.scale.set(1, 1, 1);
  if (axis === "x") target.scale.x = value;
  if (axis === "y") target.scale.y = value;
  if (axis === "z") target.scale.z = value;
}

/**
 * 材质实例隔离
 * 关键优化：GLB 模型可能共享材质实例，直接修改会导致连锁变色
 * 通过 clone() 创建独立材质副本，并标记已隔离
 * 
 * @param part - 需要隔离材质的部件
 */
function isolatePartMaterials(part: THREE.Object3D | undefined) {
  if (!part) return;
  part.traverse((node) => {
    if (!(node instanceof THREE.Mesh) || !node.material) return;

    if (Array.isArray(node.material)) {
      // 多材质情况：逐个克隆
      node.material = node.material.map((mat) => {
        const src = mat as THREE.Material;
        if (src.userData.__isolatedForCueCustomizer) return src;  // 已隔离则跳过
        const cloned = src.clone();
        cloned.userData.__isolatedForCueCustomizer = true;
        return cloned;
      });
    } else {
      // 单材质情况
      const material = node.material as THREE.Material;
      if (material.userData.__isolatedForCueCustomizer) return;
      const cloned = material.clone();
      cloned.userData.__isolatedForCueCustomizer = true;
      node.material = cloned;
    }
  });
}

/** 对所有球杆部件执行材质隔离 */
function isolateAllPartMaterials(parts: CueModelParts) {
  isolatePartMaterials(parts.tip);
  isolatePartMaterials(parts.ferrule);
  isolatePartMaterials(parts.shaft);
  isolatePartMaterials(parts.joint);
  isolatePartMaterials(parts.grip);
  isolatePartMaterials(parts.butt);
}

/**
 * 模型材质诊断与修复
 * 统计模型材质情况，并为缺失材质的网格补默认材质
 * 避免纯灰色不可读的问题
 * 
 * @param root - 模型根节点
 * @returns 诊断统计信息
 */
function inspectAndPatchMaterials(root: THREE.Object3D): ModelDiagnostic {
  const uniqueMaterials = new Set<THREE.Material>();
  let meshCount = 0;
  let texturedMaterialCount = 0;
  let missingMaterialMeshCount = 0;

  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    meshCount += 1;

    if (!node.material) {
      // 缺失材质：补默认灰色材质
      missingMaterialMeshCount += 1;
      node.material = new THREE.MeshStandardMaterial({
        color: "#606872",
        roughness: 0.46,
        metalness: 0.24,
      });
      return;
    }

    const materials = Array.isArray(node.material) ? node.material : [node.material];
    materials.forEach((material) => {
      uniqueMaterials.add(material);
      // 统计带贴图的材质（用于调试）
      if (material instanceof THREE.MeshStandardMaterial && material.map) {
        texturedMaterialCount += 1;
      }
    });
  });

  return {
    meshCount,
    materialCount: uniqueMaterials.size,
    texturedMaterialCount,
    missingMaterialMeshCount,
  };
}

/**
 * 解析 GLB 模型结构，映射到球杆部件
 * 按命名约定查找：tip/ferrule/shaft/joint/grip/butt
 */
function resolveCueParts(root: THREE.Object3D): CueModelParts {
  return {
    root,
    tip: findNodeByExactName(root, "tip"),
    ferrule: findNodeByExactName(root, "ferrule"),
    shaft: findNodeByExactName(root, "shaft"),
    joint: findNodeByExactName(root, "joint"),
    grip: findNodeByExactName(root, "grip"),
    butt: findNodeByExactName(root, "butt"),
  };
}

/** 检查缺失的部件，返回缺失名称列表用于调试提示 */
function getMissingPartNames(parts: CueModelParts) {
  const missing: string[] = [];
  if (!parts.tip) missing.push("tip");
  if (!parts.ferrule) missing.push("ferrule");
  if (!parts.shaft) missing.push("shaft");
  if (!parts.joint) missing.push("joint");
  if (!parts.grip) missing.push("grip");
  if (!parts.butt) missing.push("butt");
  return missing;
}

/**
 * 核心函数：将配置参数应用到 3D 模型
 * 
 * 参数化逻辑：
 * 1. 长度：整体缩放（147cm 为基准）
 * 2. 皮头直径：tip 部件径向缩放（11mm 为基准）
 * 3. 重量：butt 部件径向缩放模拟配重变化（19oz 为基准）
 * 4. 材质：根据涂装风格和握把类型映射颜色
 */
function applyCueConfig(parts: CueModelParts, config: CueConfig, source: CueModelSource) {
  // 1) 长度参数化：基准 147cm，按比例缩放
  const lengthScale = config.lengthCm / 147;
  setScaleByAxis(parts.root, source.lengthAxis, lengthScale * source.baseScale);

  // 2) 皮头直径参数化：基准 11mm，限制在 0.88-1.12 倍避免畸形
  if (parts.tip) {
    const tipScale = THREE.MathUtils.clamp(config.tipDiameterMm / 11, 0.88, 1.12);
    parts.tip.scale.set(tipScale, 1, tipScale);  // 仅缩放 XZ 平面（径向）
  }

  // 3) 重量视觉参数化：通过后把粗细模拟
  // 每偏离 4oz，后把粗细变化约 12%，限制在 0.9-1.14 倍
  if (parts.butt) {
    const weightDelta = (config.weightOz - 19) / 4;
    const radialScale = THREE.MathUtils.clamp(1 + weightDelta * 0.12, 0.9, 1.14);
    parts.butt.scale.set(radialScale, 1, radialScale);
  }

  // 4) 材质颜色映射表
  // 前节颜色：根据涂装风格
  const shaftColorMap: Record<FinishStyle, string> = {
    "matte-carbon": "#3b424a",
    "gloss-carbon": "#2f3840",
    "stealth-black": "#111111",
    "ice-silver": "#c7d0db",
    "ocean-blue": "#2f5f93",
    "crimson-red": "#8c2b2b",
  };
  // 后把颜色：比前节略深，增加层次感
  const buttColorMap: Record<FinishStyle, string> = {
    "matte-carbon": "#2a2f35",
    "gloss-carbon": "#252c33",
    "stealth-black": "#171717",
    "ice-silver": "#b4bfcb",
    "ocean-blue": "#294f79",
    "crimson-red": "#7a2323",
  };

  const shaftColor = shaftColorMap[config.finishStyle];
  // 握把颜色：真皮为棕色，无缠把继承前节色，碳纤维为深灰
  const gripColor =
    config.wrapType === "genuine-leather"
      ? "#3e2a1f"
      : config.wrapType === "none"
        ? shaftColor
        : "#2f2f2f";
  // 接牙颜色：钛合金偏银灰，不锈钢偏白灰
  const jointColor = config.jointType === "titanium" ? "#9ca9b6" : "#b8bdc3";
  const buttColor = buttColorMap[config.finishStyle];

  // 应用材质属性：颜色、粗糙度、金属度
  // 前节：高亮碳纹更光滑（roughness 0.16），其他较磨砂（0.45）
  setPartMaterialColor(parts.shaft, shaftColor, config.finishStyle === "gloss-carbon" ? 0.16 : 0.45, 0.35);
  // 握把：统一较粗糙（0.72），低金属感（0.12）
  setPartMaterialColor(parts.grip, gripColor, 0.72, 0.12);
  // 接牙：金属质感，较高金属度（0.74）
  setPartMaterialColor(parts.joint, jointColor, 0.22, 0.74);
  // 先角：乳白色，光滑
  setPartMaterialColor(parts.ferrule, "#f2f2ec", 0.28, 0.08);
  // 皮头：蓝色调，非常粗糙
  setPartMaterialColor(parts.tip, "#8fb7d6", 0.82, 0.06);
  // 后把：中等粗糙度
  setPartMaterialColor(parts.butt, buttColor, 0.38, 0.3);
}

/** 清理 Three.js 资源，防止内存泄漏 */
function disposeModel(root: THREE.Object3D) {
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    node.geometry.dispose();  // 释放几何体
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    materials.forEach((material) => material.dispose());  // 释放材质
  });
}

/**
 * 价格计算引擎
 * 基于配置项逐项累加，支持正负差价
 */
function calculatePrice(config: CueConfig) {
  const lines: PriceLine[] = [{ label: "碳纤维基础杆体", amount: 1880 }];

  // 长度调整：每厘米 ±26 元
  lines.push({ label: `长度调整（${config.lengthCm}cm）`, amount: (config.lengthCm - 147) * 26 });
  // 重量调整：每盎司 ±80 元
  lines.push({ label: `重量调整（${config.weightOz}oz）`, amount: Math.round((config.weightOz - 19) * 80) });
  // 接牙类型
  lines.push({
    label: `接牙类型：${config.jointType === "titanium" ? "钛合金" : "不锈钢"}`,
    amount: config.jointType === "titanium" ? 320 : 180,
  });
  // 握把类型
  lines.push({
    label:
      config.wrapType === "genuine-leather"
        ? "握把：真皮"
        : config.wrapType === "none"
          ? "握把：无缠把"
          : "握把：碳纤维防滑握把",
    amount: config.wrapType === "genuine-leather" ? 280 : config.wrapType === "none" ? 0 : 160,
  });
  // 涂装风格
  lines.push({
    label:
      config.finishStyle === "gloss-carbon"
        ? "涂装：高亮碳纹"
        : config.finishStyle === "stealth-black"
          ? "涂装：隐形黑"
          : config.finishStyle === "ice-silver"
            ? "涂装：冰川银"
            : config.finishStyle === "ocean-blue"
              ? "涂装：海洋蓝"
              : config.finishStyle === "crimson-red"
                ? "涂装：深红"
          : "涂装：磨砂碳纹",
    amount:
      config.finishStyle === "matte-carbon"
        ? 0
        : config.finishStyle === "ice-silver" || config.finishStyle === "ocean-blue"
          ? 280
          : 260,
  });
  // 球杆盒
  lines.push({
    label:
      config.caseOption === "none"
        ? "球杆盒：不选择"
        : config.caseOption === "pro"
          ? "球杆盒：专业硬壳"
          : "球杆盒：基础软包",
    amount: config.caseOption === "none" ? 0 : config.caseOption === "pro" ? 460 : 180,
  });

  // 增值服务
  if (config.includeLaserEngraving) {
    lines.push({ label: "激光刻字", amount: 160 });
  }

  return {
    lines,
    total: lines.reduce((sum, item) => sum + item.amount, 0),
  };
}

// ==================== React 组件区 ====================

/**
 * 碳纤维台球杆定制主组件
 * 
 * 状态管理：
 * - config: 当前配置参数
 * - loadState: 模型加载状态（loading/ready/error）
 * - diagnostic: 模型诊断信息
 * - missingParts: 未匹配到的部件列表
 * 
 * Refs（Three.js 实例引用，避免重渲染）：
 * - previewRef: 3D 画布容器 DOM
 * - rendererRef/cameraRef/sceneRef: Three.js 核心实例
 * - cueGroupRef: 球杆模型组
 * - partsRef: 部件映射缓存
 * - loadedRootRef: 已加载的模型根节点（用于清理）
 */
function PoolCueCustomization() {
  // ===== 状态定义 =====
  const [config, setConfig] = useState(INITIAL_CONFIG);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [diagnostic, setDiagnostic] = useState<ModelDiagnostic | null>(null);
  const [missingParts, setMissingParts] = useState<string[]>([]);

  // ===== Refs 定义 =====
  const previewRef = useRef<HTMLDivElement | null>(null);      // 3D 容器
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null); // 渲染器
  const sceneRef = useRef<THREE.Scene | null>(null);            // 场景
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null); // 相机
  const cueGroupRef = useRef<THREE.Group | null>(null);         // 球杆组
  const partsRef = useRef<CueModelParts | null>(null);          // 部件映射
  const loadedRootRef = useRef<THREE.Object3D | null>(null);      // 已加载模型

  // 价格计算（缓存优化）
  const pricing = useMemo(() => calculatePrice(config), [config]);

  // ===== Effect 1: 初始化 Three.js 场景（仅执行一次） =====
  useEffect(() => {
    const mount = previewRef.current;
    if (!mount) return;

    // --- 场景搭建 ---
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      48,                                    // 视场角
      mount.clientWidth / Math.max(mount.clientHeight, 1),  // 宽高比
      0.01, 40                               // 近远裁剪面
    );
    camera.position.set(0.42, 0.25, 0.72);   // 相机位置
    camera.lookAt(0, 0, 0);                  // 看向原点

    // 渲染器配置
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,    // 抗锯齿
      alpha: true         // 透明背景
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));  // 限制像素比
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;  // 正确色彩空间
    mount.appendChild(renderer.domElement);

    // --- 灯光系统 ---
    const ambient = new THREE.AmbientLight("#ffffff", 0.82);   // 环境光
    const key = new THREE.DirectionalLight("#f8fbff", 1.3);  // 主光源
    key.position.set(2, 2, 2);
    const fill = new THREE.DirectionalLight("#9ec8e9", 0.45);  // 补光
    fill.position.set(-1.5, -1.2, 1.2);

    // --- 地面 ---
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(1.1, 64),
      new THREE.MeshStandardMaterial({ color: "#e8eff5", roughness: 0.94, metalness: 0.05 })
    );
    floor.rotation.x = -Math.PI / 2;  // 水平放置
    floor.position.y = -0.08;         // 略低于球杆

    // --- 球杆组 ---
    const cueGroup = new THREE.Group();
    cueGroup.rotation.set(...MODEL_SOURCE.baseRotation);  // 应用基础旋转
    scene.add(ambient, key, fill, floor, cueGroup);

    // 保存引用
    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;
    cueGroupRef.current = cueGroup;

    // --- 模型加载 ---
    let stop = false;  // 卸载标记
    const loader = new GLTFLoader();

    loader.load(
      MODEL_SOURCE.url,
      (gltf) => {
        if (stop || !cueGroupRef.current) return;

        const root = gltf.scene;
        root.scale.setScalar(MODEL_SOURCE.baseScale);
        cueGroupRef.current.add(root);
        loadedRootRef.current = root;

        // 材质诊断与修复
        const diag = inspectAndPatchMaterials(root);
        setDiagnostic(diag);

        // 解析部件并隔离材质
        partsRef.current = resolveCueParts(root);
        isolateAllPartMaterials(partsRef.current);
        setMissingParts(getMissingPartNames(partsRef.current));

        // 应用初始配置
        applyCueConfig(partsRef.current, config, MODEL_SOURCE);
        setLoadState("ready");
      },
      undefined,  // 进度回调（未使用）
      () => {
        if (!stop) setLoadState("error");
      }
    );

    // --- 动画循环 ---
    let frameId = 0;
    const animate = () => {
      cueGroup.rotation.y += 0.0052;  // 缓慢自转展示
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);

    // --- 响应式处理 ---
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      const width = entry.contentRect.width;
      const height = Math.max(entry.contentRect.height, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    });
    resizeObserver.observe(mount);

    // --- 清理函数 ---
    return () => {
      stop = true;
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      if (loadedRootRef.current) {
        disposeModel(loadedRootRef.current);
        cueGroup.remove(loadedRootRef.current);
      }
      floor.geometry.dispose();
      (floor.material as THREE.Material).dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);  // 空依赖：仅挂载时执行

  // ===== Effect 2: 配置变更时更新模型 =====
  useEffect(() => {
    if (!partsRef.current || loadState !== "ready") return;
    applyCueConfig(partsRef.current, config, MODEL_SOURCE);
    // 强制重渲染（配置变更时动画循环可能未覆盖）
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
  }, [config, loadState]);

  // ===== 渲染 UI =====
  return (
    <main className={styles.page}>
      {/* 页面头部 */}
      <section className={styles.header}>
        <div>
          <h1>碳纤维台球杆参数化定制</h1>
          <p>外部 GLB 模型驱动，参数变更实时映射到 3D 效果和报价。</p>
        </div>
        <Link className={styles.backLink} to="/product-customization">
          返回产品定制中心
        </Link>
      </section>

      {/* 三栏布局：配置面板 | 3D 预览 | 价格面板 */}
      <section className={styles.layout}>
        {/* 左侧：配置参数控制 */}
        <article className={styles.panel}>
          <h2>配置参数</h2>

          {/* 长度滑块 */}
          <label className={styles.field}>
            <span>球杆长度：{config.lengthCm} cm</span>
            <input
              type="range"
              min={142}
              max={150}
              step={1}
              value={config.lengthCm}
              onChange={(event) => setConfig((prev) => ({ ...prev, lengthCm: Number(event.target.value) }))}
            />
          </label>

          {/* 重量滑块 */}
          <label className={styles.field}>
            <span>球杆重量：{config.weightOz.toFixed(1)} oz</span>
            <input
              type="range"
              min={17}
              max={21}
              step={0.5}
              value={config.weightOz}
              onChange={(event) => setConfig((prev) => ({ ...prev, weightOz: Number(event.target.value) }))}
            />
          </label>

          {/* 皮头直径选择 */}
          <label className={styles.field}>
            <span>皮头直径</span>
            <select
              value={config.tipDiameterMm}
              onChange={(event) => setConfig((prev) => ({ ...prev, tipDiameterMm: Number(event.target.value) }))}
            >
              {[10, 10.5, 11, 11.5, 12].map((value) => (
                <option value={value} key={value}>
                  {value} mm
                </option>
              ))}
            </select>
          </label>

          {/* 接牙类型 */}
          <label className={styles.field}>
            <span>接牙类型</span>
            <select
              value={config.jointType}
              onChange={(event) => setConfig((prev) => ({ ...prev, jointType: event.target.value as JointType }))}
            >
              <option value="stainless-steel">不锈钢接牙</option>
              <option value="titanium">钛合金接牙</option>
            </select>
          </label>

          {/* 握把类型 */}
          <label className={styles.field}>
            <span>握把</span>
            <select
              value={config.wrapType}
              onChange={(event) => setConfig((prev) => ({ ...prev, wrapType: event.target.value as WrapType }))}
            >
              <option value="carbon-grip">碳纤维防滑握把</option>
              <option value="genuine-leather">真皮</option>
              <option value="none">无缠把</option>
            </select>
          </label>

          {/* 涂装风格 */}
          <label className={styles.field}>
            <span>表面涂装</span>
            <select
              value={config.finishStyle}
              onChange={(event) => setConfig((prev) => ({ ...prev, finishStyle: event.target.value as FinishStyle }))}
            >
              <option value="matte-carbon">磨砂碳纹</option>
              <option value="gloss-carbon">高亮碳纹</option>
              <option value="stealth-black">隐形黑</option>
              <option value="ice-silver">冰川银</option>
              <option value="ocean-blue">海洋蓝</option>
              <option value="crimson-red">深红</option>
            </select>
          </label>

          {/* 球杆盒 */}
          <label className={styles.field}>
            <span>球杆盒</span>
            <select
              value={config.caseOption}
              onChange={(event) => setConfig((prev) => ({ ...prev, caseOption: event.target.value as CaseOption }))}
            >
              <option value="none">不需要</option>
              <option value="basic">基础软包</option>
              <option value="pro">专业硬壳</option>
            </select>
          </label>

          {/* 激光刻字开关 */}
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={config.includeLaserEngraving}
              onChange={(event) => setConfig((prev) => ({ ...prev, includeLaserEngraving: event.target.checked }))}
            />
            <span>增加激光刻字服务</span>
          </label>
        </article>

        {/* 中间：3D 模型预览 */}
        <article className={styles.previewPanel}>
          <h2>GLB 模型预览</h2>
          <div className={styles.preview} ref={previewRef} />

          {/* 加载状态提示 */}
          <p className={styles.previewHint}>
            {loadState === "loading" && "模型加载中..."}
            {loadState === "ready" && "模型已加载，参数修改会实时生效"}
            {loadState === "error" && "模型加载失败，请确认 public/models/pool-cue-carbon.glb 是否存在"}
          </p>

          {/* 诊断信息（仅就绪状态显示） */}
          {loadState === "ready" && diagnostic && (
            <p className={styles.previewHint}>
              模型诊断：网格 {diagnostic.meshCount} 个，材质 {diagnostic.materialCount} 个，
              贴图材质 {diagnostic.texturedMaterialCount} 个，
              无材质网格 {diagnostic.missingMaterialMeshCount} 个。
            </p>
          )}

          {/* 部件匹配警告 */}
          {loadState === "ready" && missingParts.length > 0 && (
            <p className={styles.previewHint}>
              未匹配部件：{missingParts.join(", ")}。
              请确认 glb 中节点名与 `butt/ferrule/grip/joint/shaft/tip` 一致。
            </p>
          )}

          {/* 材质缺失警告 */}
          {loadState === "ready" && diagnostic && diagnostic.materialCount === 0 && (
            <p className={styles.previewHint}>
              当前 glb 未包含材质数据（materials=0），页面已临时补默认材质。
              请在 DCC 软件中重新导出并勾选材质与纹理嵌入。
            </p>
          )}
        </article>

        {/* 右侧：实时价格计算 */}
        <article className={styles.pricePanel}>
          <h2>实时价格</h2>
          <p className={styles.total}>{CURRENCY.format(pricing.total)}</p>
          <ul className={styles.priceList}>
            {pricing.lines.map((line) => (
              <li key={line.label}>
                <span>{line.label}</span>
                <strong>
                  {line.amount >= 0 ? "+" : "-"}
                  {CURRENCY.format(Math.abs(line.amount))}
                </strong>
              </li>
            ))}
          </ul>
        </article>
      </section>
    </main>
  );
}

export default PoolCueCustomization;