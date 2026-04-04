import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import styles from "../css/PoolCueCustomization.module.css";

// 接牙材质类型
type JointType = "stainless-steel" | "titanium";
// 握把类型
type WrapType = "carbon-grip" | "genuine-leather" | "none";
// 球杆盒选项
type CaseOption = "none" | "basic" | "pro";
// 涂装风格
type FinishStyle =
  | "matte-carbon"
  | "gloss-carbon"
  | "stealth-black"
  | "ice-silver"
  | "ocean-blue"
  | "crimson-red";

interface CueConfig {
  lengthCm: number;
  weightOz: number;
  tipDiameterMm: number;
  jointType: JointType;
  wrapType: WrapType;
  finishStyle: FinishStyle;
  caseOption: CaseOption;
  includeLaserEngraving: boolean;
}

interface PriceLine {
  label: string;
  amount: number;
}

interface CueModelSource {
  // public 目录下模型地址
  url: string;
  // 模型长度轴，用于参数化拉伸
  lengthAxis: "x" | "y" | "z";
  // 模型基础旋转（弧度）
  baseRotation: [number, number, number];
  // 模型基础缩放
  baseScale: number;
}

interface CueModelParts {
  root: THREE.Object3D;
  tip?: THREE.Object3D;
  ferrule?: THREE.Object3D;
  shaft?: THREE.Object3D;
  joint?: THREE.Object3D;
  grip?: THREE.Object3D;
  butt?: THREE.Object3D;
}

interface ModelDiagnostic {
  meshCount: number;
  materialCount: number;
  texturedMaterialCount: number;
  missingMaterialMeshCount: number;
}

const MODEL_SOURCE: CueModelSource = {
  url: "/models/pool-cue-carbon.glb",
  lengthAxis: "y",
  baseRotation: [0, 0, -Math.PI / 2],
  baseScale: 1,
};

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

const CURRENCY = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
  minimumFractionDigits: 0,
});

// 精确按节点名查找部件（兼容大小写）
function findNodeByExactName(root: THREE.Object3D, name: string) {
  let result: THREE.Object3D | undefined;
  root.traverse((node) => {
    if (result) {
      return;
    }
    if (node.name.toLowerCase() === name.toLowerCase()) {
      result = node;
    }
  });
  return result;
}

// 在一个部件节点下，批量修改所有 Mesh 的材质参数
function setPartMaterialColor(
  part: THREE.Object3D | undefined,
  color: string,
  roughness?: number,
  metalness?: number
) {
  if (!part) return;

  part.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    materials.forEach((material) => {
      // GLB 常见材质是 MeshStandardMaterial 或其子类 MeshPhysicalMaterial
      if (material instanceof THREE.MeshStandardMaterial) {
        material.color.set(color);
        if (typeof roughness === "number") material.roughness = roughness;
        if (typeof metalness === "number") material.metalness = metalness;
        material.needsUpdate = true;
      }
    });
  });
}

function setScaleByAxis(target: THREE.Object3D, axis: CueModelSource["lengthAxis"], value: number) {
  target.scale.set(1, 1, 1);
  if (axis === "x") target.scale.x = value;
  if (axis === "y") target.scale.y = value;
  if (axis === "z") target.scale.z = value;
}

// 将部件内网格材质“实例隔离”，避免多个部件共享同一材质导致颜色互相覆盖
function isolatePartMaterials(part: THREE.Object3D | undefined) {
  if (!part) return;
  part.traverse((node) => {
    if (!(node instanceof THREE.Mesh) || !node.material) return;
    if (Array.isArray(node.material)) {
      node.material = node.material.map((mat) => {
        const src = mat as THREE.Material;
        if (src.userData.__isolatedForCueCustomizer) return src;
        const cloned = src.clone();
        cloned.userData.__isolatedForCueCustomizer = true;
        return cloned;
      });
      return;
    }
    const material = node.material as THREE.Material;
    if (material.userData.__isolatedForCueCustomizer) return;
    const cloned = material.clone();
    cloned.userData.__isolatedForCueCustomizer = true;
    node.material = cloned;
  });
}

function isolateAllPartMaterials(parts: CueModelParts) {
  isolatePartMaterials(parts.tip);
  isolatePartMaterials(parts.ferrule);
  isolatePartMaterials(parts.shaft);
  isolatePartMaterials(parts.joint);
  isolatePartMaterials(parts.grip);
  isolatePartMaterials(parts.butt);
}

// 统计模型材质情况，并对“没有材质”的网格补一个临时材质，避免纯灰不可读
function inspectAndPatchMaterials(root: THREE.Object3D): ModelDiagnostic {
  const uniqueMaterials = new Set<THREE.Material>();
  let meshCount = 0;
  let texturedMaterialCount = 0;
  let missingMaterialMeshCount = 0;

  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    meshCount += 1;

    if (!node.material) {
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

function resolveCueParts(root: THREE.Object3D): CueModelParts {
  return {
    root,
    // 你提供的模型结构：butt/ferrule/grip/joint/shaft/tip
    // 这里按精确名字匹配，确保每个部件可独立改材质
    tip: findNodeByExactName(root, "tip"),
    ferrule: findNodeByExactName(root, "ferrule"),
    shaft: findNodeByExactName(root, "shaft"),
    joint: findNodeByExactName(root, "joint"),
    grip: findNodeByExactName(root, "grip"),
    butt: findNodeByExactName(root, "butt"),
  };
}

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

function applyCueConfig(parts: CueModelParts, config: CueConfig, source: CueModelSource) {
  // 1) 长度参数化
  const lengthScale = config.lengthCm / 147;
  setScaleByAxis(parts.root, source.lengthAxis, lengthScale * source.baseScale);

  // 2) 皮头直径参数化
  if (parts.tip) {
    const tipScale = THREE.MathUtils.clamp(config.tipDiameterMm / 11, 0.88, 1.12);
    parts.tip.scale.set(tipScale, 1, tipScale);
  }

  // 3) 重量视觉参数化（通过后把粗细模拟）
  if (parts.butt) {
    const weightDelta = (config.weightOz - 19) / 4;
    const radialScale = THREE.MathUtils.clamp(1 + weightDelta * 0.12, 0.9, 1.14);
    parts.butt.scale.set(radialScale, 1, radialScale);
  }

  // 4) 材质参数化
  const shaftColorMap: Record<FinishStyle, string> = {
    "matte-carbon": "#3b424a",
    "gloss-carbon": "#2f3840",
    "stealth-black": "#111111",
    "ice-silver": "#c7d0db",
    "ocean-blue": "#2f5f93",
    "crimson-red": "#8c2b2b",
  };
  const buttColorMap: Record<FinishStyle, string> = {
    "matte-carbon": "#2a2f35",
    "gloss-carbon": "#252c33",
    "stealth-black": "#171717",
    "ice-silver": "#b4bfcb",
    "ocean-blue": "#294f79",
    "crimson-red": "#7a2323",
  };
  const shaftColor = shaftColorMap[config.finishStyle];

  const gripColor =
    config.wrapType === "genuine-leather"
      ? "#3e2a1f"
      : config.wrapType === "none"
        ? shaftColor
        : "#2f2f2f";

  const jointColor = config.jointType === "titanium" ? "#9ca9b6" : "#b8bdc3";

  const buttColor = buttColorMap[config.finishStyle];

  setPartMaterialColor(parts.shaft, shaftColor, config.finishStyle === "gloss-carbon" ? 0.16 : 0.45, 0.35);
  setPartMaterialColor(parts.grip, gripColor, 0.72, 0.12);
  setPartMaterialColor(parts.joint, jointColor, 0.22, 0.74);
  setPartMaterialColor(parts.ferrule, "#f2f2ec", 0.28, 0.08);
  setPartMaterialColor(parts.tip, "#8fb7d6", 0.82, 0.06);
  setPartMaterialColor(parts.butt, buttColor, 0.38, 0.3);
}

function disposeModel(root: THREE.Object3D) {
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    node.geometry.dispose();
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    materials.forEach((material) => material.dispose());
  });
}

function calculatePrice(config: CueConfig) {
  const lines: PriceLine[] = [{ label: "碳纤维基础杆体", amount: 1880 }];

  lines.push({ label: `长度调整（${config.lengthCm}cm）`, amount: (config.lengthCm - 147) * 26 });
  lines.push({ label: `重量调整（${config.weightOz}oz）`, amount: Math.round((config.weightOz - 19) * 80) });
  lines.push({
    label: `接牙类型：${config.jointType === "titanium" ? "钛合金" : "不锈钢"}`,
    amount: config.jointType === "titanium" ? 320 : 180,
  });
  lines.push({
    label:
      config.wrapType === "genuine-leather"
        ? "握把：真皮"
        : config.wrapType === "none"
          ? "握把：无缠把"
          : "握把：碳纤维防滑握把",
    amount: config.wrapType === "genuine-leather" ? 280 : config.wrapType === "none" ? 0 : 160,
  });
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
  lines.push({
    label:
      config.caseOption === "none"
        ? "球杆盒：不选择"
        : config.caseOption === "pro"
          ? "球杆盒：专业硬壳"
          : "球杆盒：基础软包",
    amount: config.caseOption === "none" ? 0 : config.caseOption === "pro" ? 460 : 180,
  });

  if (config.includeLaserEngraving) {
    lines.push({ label: "激光刻字", amount: 160 });
  }

  return {
    lines,
    total: lines.reduce((sum, item) => sum + item.amount, 0),
  };
}

function PoolCueCustomization() {
  const [config, setConfig] = useState(INITIAL_CONFIG);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [diagnostic, setDiagnostic] = useState<ModelDiagnostic | null>(null);
  const [missingParts, setMissingParts] = useState<string[]>([]);

  const previewRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const cueGroupRef = useRef<THREE.Group | null>(null);
  const partsRef = useRef<CueModelParts | null>(null);
  const loadedRootRef = useRef<THREE.Object3D | null>(null);

  const pricing = useMemo(() => calculatePrice(config), [config]);

  useEffect(() => {
    const mount = previewRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(48, mount.clientWidth / Math.max(mount.clientHeight, 1), 0.01, 40);
    camera.position.set(0.42, 0.25, 0.72);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight("#ffffff", 0.82);
    const key = new THREE.DirectionalLight("#f8fbff", 1.3);
    key.position.set(2, 2, 2);
    const fill = new THREE.DirectionalLight("#9ec8e9", 0.45);
    fill.position.set(-1.5, -1.2, 1.2);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(1.1, 64),
      new THREE.MeshStandardMaterial({ color: "#e8eff5", roughness: 0.94, metalness: 0.05 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.08;

    const cueGroup = new THREE.Group();
    cueGroup.rotation.set(...MODEL_SOURCE.baseRotation);
    scene.add(ambient, key, fill, floor, cueGroup);

    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;
    cueGroupRef.current = cueGroup;

    let stop = false;
    const loader = new GLTFLoader();

    /**
     * 模型接入要求：
     * 1. 建议单位为米，球杆长度约 1.47m。
     * 2. 建议按部件拆分子网格，命名包含 tip/ferrule/shaft/joint/grip/butt。
     * 3. 若主轴不是 Y 轴，请改 MODEL_SOURCE.lengthAxis。
     * 4. 导出 glb 时请勾选材质和纹理嵌入。
     */
    loader.load(
      MODEL_SOURCE.url,
      (gltf) => {
        if (stop || !cueGroupRef.current) return;

        const root = gltf.scene;
        root.scale.setScalar(MODEL_SOURCE.baseScale);
        cueGroupRef.current.add(root);
        loadedRootRef.current = root;

        const diag = inspectAndPatchMaterials(root);
        setDiagnostic(diag);

        partsRef.current = resolveCueParts(root);
        isolateAllPartMaterials(partsRef.current);
        setMissingParts(getMissingPartNames(partsRef.current));
        applyCueConfig(partsRef.current, config, MODEL_SOURCE);
        setLoadState("ready");
      },
      undefined,
      () => {
        if (!stop) setLoadState("error");
      }
    );

    let frameId = 0;
    const animate = () => {
      cueGroup.rotation.y += 0.0052;
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      const width = entry.contentRect.width;
      const height = Math.max(entry.contentRect.height, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    });
    resizeObserver.observe(mount);

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
  }, []);

  useEffect(() => {
    if (!partsRef.current || loadState !== "ready") return;
    applyCueConfig(partsRef.current, config, MODEL_SOURCE);
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
  }, [config, loadState]);

  return (
    <main className={styles.page}>
      <section className={styles.header}>
        <div>
          <h1>碳纤维台球杆参数化定制</h1>
          <p>外部 GLB 模型驱动，参数变更实时映射到 3D 效果和报价。</p>
        </div>
        <Link className={styles.backLink} to="/product-customization">
          返回产品定制中心
        </Link>
      </section>

      <section className={styles.layout}>
        <article className={styles.panel}>
          <h2>配置参数</h2>

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

          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={config.includeLaserEngraving}
              onChange={(event) => setConfig((prev) => ({ ...prev, includeLaserEngraving: event.target.checked }))}
            />
            <span>增加激光刻字服务</span>
          </label>
        </article>

        <article className={styles.previewPanel}>
          <h2>GLB 模型预览</h2>
          <div className={styles.preview} ref={previewRef} />
          <p className={styles.previewHint}>
            {loadState === "loading" && "模型加载中..."}
            {loadState === "ready" && "模型已加载，参数修改会实时生效"}
            {loadState === "error" && "模型加载失败，请确认 public/models/pool-cue-carbon.glb 是否存在"}
          </p>
          {loadState === "ready" && diagnostic && (
            <p className={styles.previewHint}>
              模型诊断：网格 {diagnostic.meshCount} 个，材质 {diagnostic.materialCount} 个，贴图材质 {diagnostic.texturedMaterialCount} 个，
              无材质网格 {diagnostic.missingMaterialMeshCount} 个。
            </p>
          )}
          {loadState === "ready" && missingParts.length > 0 && (
            <p className={styles.previewHint}>
              未匹配部件：{missingParts.join(", ")}。请确认 glb 中节点名与 `butt/ferrule/grip/joint/shaft/tip` 一致。
            </p>
          )}
          {loadState === "ready" && diagnostic && diagnostic.materialCount === 0 && (
            <p className={styles.previewHint}>
              当前 glb 未包含材质数据（materials=0），页面已临时补默认材质。请在 DCC 软件中重新导出并勾选材质与纹理嵌入。
            </p>
          )}
        </article>

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
