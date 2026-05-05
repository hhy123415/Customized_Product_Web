import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import api from "../api/axios";
import styles from "../css/PoolCueCustomization.module.css";
import { useAuth } from "../hooks/useAuth";
import { AxiosError } from "axios";

// ---------- 类型定义 ----------

/** 定制模式：参数定制 或 自由方案 */
type CustomizationMode = "preset" | "freeform";

/** 船桨使用场景 */
type PaddleUse = "touring" | "sea-touring" | "fitness";

/** 桨杆硬度/弹性 */
type ShaftFlex = "medium" | "stiff";

/** 表面处理/涂装风格 */
type FinishStyle = "matte-carbon" | "satin-carbon" | "glacier-white";

/** 完整的预设配置数据 */
interface PaddleConfig {
  use: PaddleUse;
  lengthCm: number;
  shaftFlex: ShaftFlex;
  finishStyle: FinishStyle;
}

/** 自由定制模式的状态 */
interface FreeformState {
  designDescription: string;
  referenceImagePath: string;
  referenceImageUrl: string;
  referenceImageName: string;
}

/** 订单联系信息 */
interface OrderFormState {
  contactName: string;
  contactPhone: string;
  shippingAddress: string;
}

/** 2D 放大镜的位置与采样坐标状态 */
interface MagnifierState {
  lensX: number;
  lensY: number;
  sampleX: number;
  sampleY: number;
  visible: boolean;
}

/** 2D 预览图片在页面中的实际渲染尺寸 */
interface ImageRenderSize {
  width: number;
  height: number;
}

/** 从 GLB 模型中提取的各个部件引用 */
interface PaddleModelParts {
  root: THREE.Object3D;
  blade1?: THREE.Object3D;
  blade2?: THREE.Object3D;
  shaft1?: THREE.Object3D;
  shaft2?: THREE.Object3D;
  joint1?: THREE.Object3D;
  joint2?: THREE.Object3D;
}

// ---------- 常量配置 ----------

const DEFAULT_2D_IMAGE_PATH = "/uploads/Carbon-Canoe-Paddle.jpg";

/** 3D 模型加载路径与基础变换 */
const MODEL_SOURCE = {
  url: "/models/paddle.glb",
  lengthAxis: "y" as const,
  baseRotation: [0, 0, 0] as [number, number, number],
};

/** 不同表面处理对应的材质参数 */
const FINISH_STYLES: Record<
  FinishStyle,
  { color: string; rough: number; metal: number }
> = {
  "matte-carbon": { color: "#2b3137", rough: 0.72, metal: 0.12 },
  "satin-carbon": { color: "#49525b", rough: 0.28, metal: 0.26 },
  "glacier-white": { color: "#d9e6ee", rough: 0.22, metal: 0.12 },
};

/** 预设配置的默认值 */
const INITIAL_CONFIG: PaddleConfig = {
  use: "touring",
  lengthCm: 220,
  shaftFlex: "medium",
  finishStyle: "satin-carbon",
};

/** 人民币格式化工具 */
const CURRENCY = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
  minimumFractionDigits: 0,
});

/** 2D 详情图路径 */
const IMAGE_2D_SOURCE = "/Carbon-Canoe-Paddle.jpg";

/** 放大镜镜头尺寸(px) */
const MAGNIFIER_SIZE = 170;

// ---------- Three.js 辅助函数 ----------

/**
 * 在 Three.js 节点树中按照名字查找节点（大小写不敏感）
 */
const findNode = (root: THREE.Object3D, name: string) => {
  let res: THREE.Object3D | undefined;
  root.traverse((node) => {
    if (!res && node.name.toLowerCase() === name.toLowerCase()) {
      res = node;
    }
  });
  return res;
};

/**
 * 为部件的所有材质创建独立副本，便于单独修改样式
 */
const isolateMaterials = (part: THREE.Object3D | undefined) => {
  part?.traverse((node) => {
    if (node instanceof THREE.Mesh && node.material) {
      node.material = Array.isArray(node.material)
        ? node.material.map((material) => material.clone())
        : node.material.clone();
    }
  });
};

/**
 * 设置部件的可见性，并统一应用颜色、粗糙度、金属度样式
 */
const setPartStyle = (
  part: THREE.Object3D | undefined,
  style: { color: string; rough: number; metal: number },
  visible = true,
) => {
  if (!part) return;
  part.visible = visible;
  part.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      const materials = Array.isArray(node.material)
        ? node.material
        : [node.material];
      materials.forEach((material) => {
        if (material instanceof THREE.MeshStandardMaterial) {
          material.color.set(style.color);
          material.roughness = style.rough;
          material.metalness = style.metal;
        }
      });
    }
  });
};

// ---------- 主组件 ----------

/**
 * 碳纤维双头船桨定制页面
 * 支持预设参数定制与自由方案提交，提供 3D 交互预览和 2D 细节放大视图
 */
export default function CarbonPaddleCustomization() {
  const { auth } = useAuth();

  // ---- 状态管理 ----

  /** 当前定制模式 */
  const [mode, setMode] = useState<CustomizationMode>("preset");

  /** 预设配置数据 */
  const [config, setConfig] = useState<PaddleConfig>(INITIAL_CONFIG);

  /** 自由定制描述 */
  const [freeform, setFreeform] = useState<FreeformState>({
    designDescription: "",
    referenceImagePath: "",
    referenceImageUrl: "",
    referenceImageName: "",
  });

  /** 订单联系表单 */
  const [orderForm, setOrderForm] = useState<OrderFormState>({
    contactName: "",
    contactPhone: "",
    shippingAddress: "",
  });

  /** 当前预览视图：3D 交互或 2D 详情 */
  const [viewType, setViewType] = useState<"3d" | "2d">("3d");

  /** 2D 放大镜的缩放倍率 */
  const [zoom, setZoom] = useState(2.2);

  /** 放大镜位置与可见性状态 */
  const [magnifier, setMagnifier] = useState<MagnifierState>({
    lensX: 0,
    lensY: 0,
    sampleX: 0,
    sampleY: 0,
    visible: false,
  });

  /** 图片实际渲染像素尺寸 */
  const [imageRenderSize, setImageRenderSize] = useState<ImageRenderSize>({
    width: 0,
    height: 0,
  });

  /** 3D 资源加载状态 */
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  /** 用于触发依赖模型加载完成后重新应用样式的版本号 */
  const [modelRevision, setModelRevision] = useState(0);

  // ---- Refs ----

  /** 3D 预览容器 DOM */
  const previewRef = useRef<HTMLDivElement>(null);
  /** 2D 图片外部容器 */
  const imageContainerRef = useRef<HTMLDivElement>(null);
  /** 2D 图片 img 元素 */
  const imageRef = useRef<HTMLImageElement>(null);
  /** 存储当前加载的模型部件引用 */
  const partsRef = useRef<PaddleModelParts | null>(null);
  /** 存储当前 Three.js 场景及其渲染相关对象 */
  const sceneElements = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
  } | null>(null);

  // ---- 派生状态：价格明细 ----

  /** 根据当前配置动态计算价格明细 */
  const pricing = useMemo(() => {
    const lines = [{ label: "基础可拆分双头碳纤维船桨", amount: 2280 }];
    lines.push({
      label: `长度定制 (${config.lengthCm}cm)`,
      amount: (config.lengthCm - 220) * 28,
    });

    if (config.shaftFlex === "stiff") {
      lines.push({ label: "高响应硬轴调校", amount: 160 });
    }

    if (config.finishStyle !== "matte-carbon") {
      lines.push({ label: "定制表面涂装", amount: 220 });
    }

    return { lines, total: lines.reduce((sum, line) => sum + line.amount, 0) };
  }, [config]);

  // ---- 副作用：初始化/销毁 Three.js 3D 场景 ----

  useEffect(() => {
    // 仅在预设模式下挂载 3D 场景
    if (mode !== "preset" || !previewRef.current) return;

    const mount = previewRef.current;

    // 创建场景
    const scene = new THREE.Scene();

    // 透视相机
    const camera = new THREE.PerspectiveCamera(
      45,
      mount.clientWidth / mount.clientHeight,
      0.1,
      100,
    );
    camera.position.set(1.2, 0.8, 1.5);
    camera.lookAt(0, 0, 0);

    // WebGL 渲染器
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    // 轨道控制器，支持旋转/缩放
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 0.5;
    controls.maxDistance = 8;
    controls.autoRotateSpeed = 1;

    // 基础光源
    scene.add(
      new THREE.AmbientLight(0xffffff, 0.8),
      new THREE.DirectionalLight(0xffffff, 1),
    );

    // 用 Group 包裹模型，方便整体旋转/缩放
    const paddleGroup = new THREE.Group();
    paddleGroup.rotation.set(...MODEL_SOURCE.baseRotation);
    scene.add(paddleGroup);

    // 保存场景对象引用
    sceneElements.current = { renderer, scene, camera, controls };

    // 加载 GLB 模型
    new GLTFLoader().load(
      MODEL_SOURCE.url,
      (gltf) => {
        const root = gltf.scene;
        paddleGroup.add(root);

        // 尝试查找模型中的各个命名部件
        const parts: PaddleModelParts = {
          root,
          blade1: findNode(root, "blade1"),
          blade2: findNode(root, "blade2"),
          shaft1: findNode(root, "shaft1"),
          shaft2: findNode(root, "shaft2"),
          joint1: findNode(root, "joint1"),
          joint2: findNode(root, "joint2"),
        };

        // 为每个部件创建独立材质，避免共享影响
        isolateMaterials(parts.blade1);
        isolateMaterials(parts.blade2);
        isolateMaterials(parts.shaft1);
        isolateMaterials(parts.shaft2);
        isolateMaterials(parts.joint1);
        isolateMaterials(parts.joint2);

        partsRef.current = parts;
        setLoadState("ready");
        setModelRevision((prev) => prev + 1); // 触发样式更新
      },
      undefined,
      () => setLoadState("error"),
    );

    // 动画循环
    let frameId = 0;
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    animate();

    // 清理函数：组件卸载或切换模式时销毁 Three.js 资源
    return () => {
      cancelAnimationFrame(frameId);
      controls.dispose();
      renderer.dispose();
      scene.clear();
      partsRef.current = null;
      sceneElements.current = null;
      mount.removeChild(renderer.domElement);
    };
  }, [mode]);

  // ---- 副作用：响应视图模式切换，更新控制器与相机 ----

  useEffect(() => {
    const current = sceneElements.current;
    const mount = previewRef.current;
    if (!current || !mount) return;

    // 仅在 3D 预设模式且视图为 3D 时启用轨道控制
    current.controls.enabled = mode === "preset" && viewType === "3d";

    if (mode === "preset" && viewType === "3d" && mount.clientHeight > 0) {
      current.camera.aspect = mount.clientWidth / mount.clientHeight;
      current.camera.updateProjectionMatrix();
      current.renderer.setSize(mount.clientWidth, mount.clientHeight);
    }
    current.renderer.render(current.scene, current.camera);
  }, [mode, viewType]);

  // ---- 副作用：预设模式下根据配置更新 3D 模型的外观 ----

  useEffect(() => {
    const parts = partsRef.current;
    if (mode !== "preset" || !parts || loadState !== "ready") return;

    // 通过缩放根节点模拟船桨长度变化
    const lengthScale = config.lengthCm / 220;
    parts.root.scale.set(1, 1, 1);
    parts.root.scale.z = lengthScale;

    // 应用选中的表面处理样式
    const finish = FINISH_STYLES[config.finishStyle];
    setPartStyle(parts.blade1, finish);
    setPartStyle(parts.blade2, finish);
    setPartStyle(parts.shaft1, finish);
    setPartStyle(parts.shaft2, finish);

    // 根据拆分结构设置连接件样式
    const jointStyle = { color: "#7e8790", rough: 0.35, metal: 0.55 };
    setPartStyle(parts.joint1, jointStyle);
    setPartStyle(parts.joint2, jointStyle);

    // 立即渲染一帧
    sceneElements.current?.renderer.render(
      sceneElements.current.scene,
      sceneElements.current.camera,
    );
  }, [config, loadState, mode, modelRevision]);

  // ---- 副作用：监听 2D 图片渲染尺寸变化（用于放大镜计算） ----

  useEffect(() => {
    const image = imageRef.current;
    if (!image) return;

    const updateSize = () =>
      setImageRenderSize({
        width: image.clientWidth,
        height: image.clientHeight,
      });

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(image);
    return () => observer.disconnect();
  }, [mode, viewType]);

  // ---- 事件处理 ----

  /**
   * 鼠标在 2D 图片容器上移动时，更新放大镜的位置和采样区域
   */
  const handleMagnifierMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const container = imageContainerRef.current;
    const image = imageRef.current;
    if (!container || !image) return;

    const containerRect = container.getBoundingClientRect();
    const imageRect = image.getBoundingClientRect();
    const lensRadius = MAGNIFIER_SIZE / 2;

    // 指针相对于容器的坐标
    const pointerX = event.clientX - containerRect.left;
    const pointerY = event.clientY - containerRect.top;
    // 指针相对于图片的坐标
    const relativeImageX = event.clientX - imageRect.left;
    const relativeImageY = event.clientY - imageRect.top;
    const imageLeft = imageRect.left - containerRect.left;
    const imageTop = imageRect.top - containerRect.top;

    // 镜头的移动范围限制在图片边界内
    const lensMinX = Math.min(
      imageLeft + lensRadius,
      imageLeft + imageRect.width / 2,
    );
    const lensMaxX = Math.max(
      imageLeft + imageRect.width - lensRadius,
      imageLeft + imageRect.width / 2,
    );
    const lensMinY = Math.min(
      imageTop + lensRadius,
      imageTop + imageRect.height / 2,
    );
    const lensMaxY = Math.max(
      imageTop + imageRect.height - lensRadius,
      imageTop + imageRect.height / 2,
    );

    const sampleX = Math.min(Math.max(relativeImageX, 0), imageRect.width);
    const sampleY = Math.min(Math.max(relativeImageY, 0), imageRect.height);
    const lensX = Math.min(Math.max(pointerX, lensMinX), lensMaxX);
    const lensY = Math.min(Math.max(pointerY, lensMinY), lensMaxY);

    setMagnifier({
      lensX,
      lensY,
      sampleX,
      sampleY,
      visible:
        event.clientX >= imageRect.left &&
        event.clientX <= imageRect.right &&
        event.clientY >= imageRect.top &&
        event.clientY <= imageRect.bottom,
    });
  };

  /** 鼠标离开图片容器时隐藏放大镜 */
  const handleMagnifierLeave = () => {
    setMagnifier((prev) => ({ ...prev, visible: false }));
  };

  /**
   * 提交订单，需要登录并填写完整联系信息
   */
  const handleSubmit = async () => {
    if (!auth.isLoggedIn) {
      alert("请先登录");
      return;
    }

    const { contactName, contactPhone, shippingAddress } = orderForm;
    if (!contactName || !contactPhone || !shippingAddress) {
      alert("请完善联系信息");
      return;
    }

    try {
      const payload =
        mode === "preset"
          ? {
              customization_mode: "preset",
              contact_name: contactName,
              contact_phone: contactPhone,
              shipping_address: shippingAddress,
              design_image_path: DEFAULT_2D_IMAGE_PATH,
              config,
            }
          : {
              customization_mode: "freeform",
              contact_name: contactName,
              contact_phone: contactPhone,
              shipping_address: shippingAddress,
              design_description: freeform.designDescription,
              design_image_path: freeform.referenceImagePath || null,
            };

      await api.post("/orders/carbon-paddle", payload);
      alert("订单提交成功");
    } catch (error: unknown) {
      console.error("submit carbon paddle order failed:", error);
      if (error instanceof AxiosError) {
        alert(error.response?.data?.message);
      } else {
        alert("订单提交失败，请重试");
      }
    }
  };

  /**
   * 自由定制参考图上传：
   * 先显示本地预览，再将文件上传到后端并回填服务器路径。
   */
  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const localPreviewUrl = URL.createObjectURL(file);
    setFreeform((prev) => {
      if (prev.referenceImageUrl.startsWith("blob:")) {
        URL.revokeObjectURL(prev.referenceImageUrl);
      }
      return {
        ...prev,
        referenceImageName: file.name,
        referenceImagePath: "",
        referenceImageUrl: localPreviewUrl,
      };
    });

    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await api.post("/images/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (response.data.success) {
        setFreeform((prev) => ({
          ...prev,
          referenceImagePath: response.data.path,
          referenceImageUrl: response.data.url,
        }));
      }
    } catch (error) {
      console.error("upload carbon paddle image failed:", error);
      alert("图片上传失败，请重试");
    }
  };

  useEffect(() => {
    return () => {
      if (freeform.referenceImageUrl.startsWith("blob:")) {
        URL.revokeObjectURL(freeform.referenceImageUrl);
      }
    };
  }, [freeform.referenceImageUrl]);

  // ---- 渲染 ----

  return (
    <main className={styles.page}>
      {/* 页面头部：标题与模式切换 */}
      <header className={styles.header}>
        <h1>碳纤维双头船桨定制</h1>
        <p>面向可拆分双头船桨的配置，预设项按巡航与海划场景重新整理。</p>
        <div className={styles.modeBar}>
          <button
            onClick={() => setMode("preset")}
            className={mode === "preset" ? styles.active : ""}
          >
            参数定制
          </button>
          <button
            onClick={() => setMode("freeform")}
            className={mode === "freeform" ? styles.active : ""}
          >
            自由定制
          </button>
        </div>
      </header>

      <div className={styles.layout}>
        {/* 左侧面板：配置参数或自由描述 */}
        <aside className={styles.panel}>
          {mode === "preset" ? (
            <div className={styles.controls}>
              <h2>配置参数</h2>

              <label>
                使用场景:
                <select
                  value={config.use}
                  onChange={(event) =>
                    setConfig({
                      ...config,
                      use: event.target.value as PaddleUse,
                    })
                  }
                >
                  <option value="touring">休闲巡航</option>
                  <option value="sea-touring">海划远行</option>
                  <option value="fitness">训练健身</option>
                </select>
              </label>

              <label>
                长度: {config.lengthCm}cm
                <input
                  type="range"
                  min="205"
                  max="235"
                  step="1"
                  value={config.lengthCm}
                  onChange={(event) =>
                    setConfig({
                      ...config,
                      lengthCm: Number(event.target.value),
                    })
                  }
                />
              </label>

              <label>
                桨杆硬度:
                <select
                  value={config.shaftFlex}
                  onChange={(event) =>
                    setConfig({
                      ...config,
                      shaftFlex: event.target.value as ShaftFlex,
                    })
                  }
                >
                  <option value="medium">中等回弹</option>
                  <option value="stiff">硬轴响应 (+¥160)</option>
                </select>
              </label>

              <label>
                表面处理:
                <select
                  value={config.finishStyle}
                  onChange={(event) =>
                    setConfig({
                      ...config,
                      finishStyle: event.target.value as FinishStyle,
                    })
                  }
                >
                  <option value="matte-carbon">磨砂碳纹</option>
                  <option value="satin-carbon">缎面碳纹 (+¥220)</option>
                  <option value="glacier-white">冰川白涂装 (+¥220)</option>
                </select>
              </label>
            </div>
          ) : (
            <div className={styles.freeform}>
              <h2>自由定制需求</h2>
              <textarea
                rows={6}
                placeholder="描述您期望的桨叶外形、桨杆结构、使用水域或训练需求...可以选择上传设计图"
                value={freeform.designDescription}
                onChange={(event) =>
                  setFreeform({
                    ...freeform,
                    designDescription: event.target.value,
                  })
                }
              />
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
              />
            </div>
          )}
        </aside>

        {/* 中间预览区域 */}
        <section className={styles.previewPanel}>
          {mode === "preset" ? (
            <>
              {/* 视图切换栏 */}
              <div className={styles.viewToggleBar}>
                <button
                  className={viewType === "3d" ? styles.activeView : ""}
                  onClick={() => setViewType("3d")}
                >
                  3D 交互
                </button>
                <button
                  className={viewType === "2d" ? styles.activeView : ""}
                  onClick={() => setViewType("2d")}
                >
                  2D 详情
                </button>
              </div>

              <div className={styles.previewStack}>
                {/* 3D 预览容器 */}
                <div
                  className={`${styles.preview} ${
                    viewType === "3d"
                      ? styles.activePreview
                      : styles.hiddenPreview
                  }`}
                  ref={previewRef}
                />

                {/* 2D 图片预览及放大镜 */}
                <div
                  className={`${styles.imageViewer} ${
                    viewType === "2d"
                      ? styles.activePreview
                      : styles.hiddenPreview
                  }`}
                >
                  <div
                    className={styles.imageContainer}
                    ref={imageContainerRef}
                    onMouseMove={handleMagnifierMove}
                    onMouseEnter={handleMagnifierMove}
                    onMouseLeave={handleMagnifierLeave}
                  >
                    <img
                      src={IMAGE_2D_SOURCE}
                      alt="双头船桨 2D 预览"
                      className={styles.staticImage}
                      ref={imageRef}
                      onLoad={() =>
                        setImageRenderSize({
                          width: imageRef.current?.clientWidth ?? 0,
                          height: imageRef.current?.clientHeight ?? 0,
                        })
                      }
                    />
                    {/* 放大镜镜头 */}
                    {magnifier.visible && (
                      <div
                        className={styles.magnifierLens}
                        style={{
                          left: `${magnifier.lensX}px`,
                          top: `${magnifier.lensY}px`,
                          width: `${MAGNIFIER_SIZE}px`,
                          height: `${MAGNIFIER_SIZE}px`,
                          backgroundImage: `url(${IMAGE_2D_SOURCE})`,
                          backgroundSize: `${imageRenderSize.width * zoom}px ${
                            imageRenderSize.height * zoom
                          }px`,
                          backgroundPosition: `${
                            MAGNIFIER_SIZE / 2 - magnifier.sampleX * zoom
                          }px ${
                            MAGNIFIER_SIZE / 2 - magnifier.sampleY * zoom
                          }px`,
                        }}
                      >
                        <span className={styles.magnifierCrosshair} />
                      </div>
                    )}
                  </div>

                  {/* 缩放控制滑块 */}
                  <div className={styles.zoomControls}>
                    <span>弱</span>
                    <input
                      type="range"
                      min="1.6"
                      max="4"
                      step="0.1"
                      value={zoom}
                      onChange={(event) =>
                        setZoom(parseFloat(event.target.value))
                      }
                    />
                    <span>强</span>
                    <button onClick={() => setZoom(2.2)}>重置</button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className={styles.freeformPreview}>
              <h2>设计方案预览</h2>
              {freeform.referenceImageUrl ? (
                <div className={styles.imagePreviewContainer}>
                  <img
                    src={freeform.referenceImageUrl}
                    alt="设计参考图"
                    className={styles.previewImage}
                  />
                  <p className={styles.imageCaption}>
                    {freeform.referenceImageName}
                  </p>
                </div>
              ) : (
                <div className={styles.placeholder}>
                  <p>请上传设计草图以查看预览</p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* 右侧面板：价格明细与订单表单 */}
        <aside className={styles.pricePanel}>
          {mode === "preset" ? (
            <div>
              <div className={styles.total}>
                {CURRENCY.format(pricing.total)}
              </div>
              <div className={styles.priceListTitle}>费用明细</div>
              <ul className={styles.priceList}>
                {pricing.lines.map((line) => (
                  <li key={line.label}>
                    <span className={styles.priceLabel}>{line.label}</span>
                    <span
                      className={`${styles.priceAmount} ${
                        line.amount > 0 ? styles.positive : ""
                      }`}
                    >
                      {CURRENCY.format(line.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className={styles.priceNotice}>
              价格：自由方案将由人工评估报价
            </div>
          )}

          {/* 联系信息表单 */}
          <div className={styles.orderForm}>
            <input
              placeholder="联系人"
              value={orderForm.contactName}
              onChange={(event) =>
                setOrderForm({ ...orderForm, contactName: event.target.value })
              }
            />
            <input
              placeholder="电话"
              value={orderForm.contactPhone}
              onChange={(event) =>
                setOrderForm({ ...orderForm, contactPhone: event.target.value })
              }
            />
            <textarea
              placeholder="地址"
              value={orderForm.shippingAddress}
              onChange={(event) =>
                setOrderForm({
                  ...orderForm,
                  shippingAddress: event.target.value,
                })
              }
            />
            <button className={styles.orderButton} onClick={handleSubmit}>
              提交订单
            </button>
          </div>
        </aside>
      </div>
    </main>
  );
}
