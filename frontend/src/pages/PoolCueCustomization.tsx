import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import api from "../api/axios";
import styles from "../css/PoolCueCustomization.module.css";
import { useAuth } from "../hooks/useAuth";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";

// =================================================================
// 类型定义 (Types)
// =================================================================

type JointType = "stainless-steel" | "titanium";
type WrapType = "carbon-grip" | "genuine-leather" | "none";
type CaseOption = "none" | "basic" | "pro";
type FinishStyle = "matte-carbon" | "gloss-carbon" | "ocean-blue";

interface CueConfig {
  lengthCm: number;
  weightOz: number;
  tipDiameterMm: number;
  jointType: JointType;
  wrapType: WrapType;
  finishStyle: FinishStyle;
  caseOption: CaseOption;
}

interface OrderFormState {
  contactName: string;
  contactPhone: string;
  shippingAddress: string;
}

interface MagnifierState {
  lensX: number;
  lensY: number;
  sampleX: number;
  sampleY: number;
  visible: boolean;
}

interface ImageRenderSize {
  width: number;
  height: number;
}

/** 3D模型部件引用接口 */
interface CueModelParts {
  root: THREE.Object3D;
  tip?: THREE.Object3D;
  ferrule?: THREE.Object3D;
  shaft?: THREE.Object3D;
  joint?: THREE.Object3D;
  grip?: THREE.Object3D;
  butt?: THREE.Object3D;
}

// =================================================================
// 配置常量 (Constants)
// =================================================================

const DEFAULT_IMAGE_PATH = "/uploads/preset_example.jpg";

const MODEL_SOURCE = {
  url: "/models/cue-carbon.glb",
  baseRotation: [0, 0, -Math.PI / 2] as [number, number, number],
};

/** 涂装样式参数映射表 */
const FINISH_STYLES: Record<
  FinishStyle,
  { color: string; rough: number; metal: number }
> = {
  "matte-carbon": { color: "#3b424a", rough: 0.8, metal: 0.1 },
  "gloss-carbon": { color: "#222a30", rough: 0.1, metal: 0.4 },
  "ocean-blue": { color: "#0055aa", rough: 0.2, metal: 0.3 },
};

/** 握把样式参数映射表 */
const WRAP_STYLES: Record<
  WrapType,
  { color: string; rough: number; metal: number }
> = {
  "carbon-grip": { color: "#1a1a1a", rough: 0.7, metal: 0.1 },
  "genuine-leather": { color: "#4a3225", rough: 0.9, metal: 0 },
  none: { color: "#222", rough: 0.2, metal: 0.2 }, // 光把模式：通常与后把颜色接近但更光滑
};

const INITIAL_CONFIG: CueConfig = {
  lengthCm: 147,
  weightOz: 19,
  tipDiameterMm: 11,
  jointType: "stainless-steel",
  wrapType: "carbon-grip",
  finishStyle: "ocean-blue",
  caseOption: "basic",
};

const CURRENCY = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
  minimumFractionDigits: 0,
});

// =================================================================
// 工具函数 (Utilities)
// =================================================================

/**
 * 递归查找具有特定名称的模型节点
 * @param root 根对象
 * @param name 目标节点名称
 */
const findNode = (root: THREE.Object3D, name: string) => {
  let res: THREE.Object3D | undefined;
  root.traverse((n) => {
    if (!res && n.name.toLowerCase() === name.toLowerCase()) res = n;
  });
  return res;
};

/**
 * 克隆并隔离材质实例，确保部件间的样式更新互不干扰
 * @param part 需要隔离材质的 3D 部件
 */
const isolateMaterials = (part: THREE.Object3D | undefined) => {
  part?.traverse((node) => {
    if (node instanceof THREE.Mesh && node.material) {
      node.material = Array.isArray(node.material)
        ? node.material.map((m) => m.clone())
        : node.material.clone();
    }
  });
};

/**
 * 批量设置部件的物理材质参数
 * @param part 目标部件
 * @param style 包含颜色、粗糙度、金属度的样式对象
 * @param visible 是否可见
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
      const mats = Array.isArray(node.material)
        ? node.material
        : [node.material];
      mats.forEach((m) => {
        if (m instanceof THREE.MeshStandardMaterial) {
          m.color.set(style.color);
          m.roughness = style.rough;
          m.metalness = style.metal;
        }
      });
    }
  });
};

// =================================================================
// 主组件 (Main Component)
// =================================================================

export default function PoolCueCustomization() {
  const { auth } = useAuth();
  const [mode, setMode] = useState<"preset" | "freeform">("preset");
  const [config, setConfig] = useState(INITIAL_CONFIG);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [modelRevision, setModelRevision] = useState(0);

  // 自由定制状态
  const [freeform, setFreeform] = useState({
    designDescription: "",
    referenceImagePath: "",
    referenceImageUrl: "",
    referenceImageName: "",
  });

  const [orderForm, setOrderForm] = useState<OrderFormState>({
    contactName: "",
    contactPhone: "",
    shippingAddress: "",
  });

  // Three.js 实例引用
  const previewRef = useRef<HTMLDivElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const partsRef = useRef<CueModelParts | null>(null);
  const sceneElements = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
  } | null>(null);

  /** 动态计算订单价格流水 */
  const pricing = useMemo(() => {
    const lines = [{ label: "基础球杆", amount: 1880 }];
    lines.push({
      label: `长度定制(${config.lengthCm}cm)`,
      amount: (config.lengthCm - 147) * 26,
    });
    lines.push({
      label: `重量调整(${config.weightOz}oz)`,
      amount: Math.round((config.weightOz - 19) * 80),
    });

    if (config.jointType === "titanium")
      lines.push({ label: "钛合金接牙升级", amount: 320 });
    if (config.wrapType === "genuine-leather")
      lines.push({ label: "真皮握把升级", amount: 280 });
    if (config.finishStyle !== "matte-carbon")
      lines.push({ label: "特殊涂装工艺", amount: 260 });
    if (config.caseOption === "pro")
      lines.push({ label: "专业防震硬壳盒", amount: 460 });

    return { lines, total: lines.reduce((s, i) => s + i.amount, 0) };
  }, [config]);

  const [viewType, setViewType] = useState<"3d" | "2d">("3d");
  const [zoom, setZoom] = useState(2.2);
  const [magnifier, setMagnifier] = useState<MagnifierState>({
    lensX: 0,
    lensY: 0,
    sampleX: 0,
    sampleY: 0,
    visible: false,
  });
  const [imageRenderSize, setImageRenderSize] = useState<ImageRenderSize>({
    width: 0,
    height: 0,
  });

  const IMAGE_2D_SOURCE = "/cue-2d-preview.jpg";
  const MAGNIFIER_SIZE = 170;

  /** 初始化场景与模型加载 */
  useEffect(() => {
    if (mode !== "preset" || !previewRef.current) return;
    const mount = previewRef.current;

    // 1. 基础场景构建
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      45,
      mount.clientWidth / mount.clientHeight,
      0.1,
      100,
    );
    camera.position.set(0.8, 0.5, 1.2);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 0.3;
    controls.maxDistance = 3;
    controls.autoRotateSpeed = 2.0;

    // 2. 环境光照
    scene.add(
      new THREE.AmbientLight(0xffffff, 0.4),
      new THREE.DirectionalLight(0xffffff, 1),
    );

    const cueGroup = new THREE.Group();
    cueGroup.rotation.set(...MODEL_SOURCE.baseRotation);
    scene.add(cueGroup);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    new RGBELoader()
      .setDataType(THREE.HalfFloatType)
      .load("/environment.hdr", (texture) => {
        const envMap = pmremGenerator.fromEquirectangular(texture).texture;
        scene.environment = envMap;
        scene.background = envMap;
        texture.dispose();
        pmremGenerator.dispose();
        // 环境贴图就绪后立即渲染一帧
        renderer.render(scene, camera);
      });

    sceneElements.current = { renderer, scene, camera, controls };

    // 3. 模型资源加载
    new GLTFLoader().load(
      MODEL_SOURCE.url,
      (gltf) => {
        const root = gltf.scene;
        cueGroup.add(root);

        const p: CueModelParts = {
          root,
          tip: findNode(root, "tip"),
          ferrule: findNode(root, "ferrule"),
          shaft: findNode(root, "shaft"),
          joint: findNode(root, "joint"),
          grip: findNode(root, "grip"),
          butt: findNode(root, "butt"),
        };

        partsRef.current = p;
        Object.values(p).forEach(
          (part) => part instanceof THREE.Object3D && isolateMaterials(part),
        );
        setLoadState("ready");
        setModelRevision((prev) => prev + 1);
      },
      undefined,
      () => {
        setLoadState("error");
      },
    );

    // 4. 渲染循环
    let frameId: number;
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      controls.dispose();
      renderer.dispose();
      scene.clear();
      partsRef.current = null;
      sceneElements.current = null;
      mount.removeChild(renderer.domElement);
      if (scene.environment) scene.environment.dispose();
      if (scene.background === scene.environment) scene.background = null;
    };
  }, [mode]);

  useEffect(() => {
    const current = sceneElements.current;
    const mount = previewRef.current;
    if (!current || !mount) return;

    current.controls.enabled = mode === "preset" && viewType === "3d";
    if (mode === "preset" && viewType === "3d" && mount.clientHeight > 0) {
      current.camera.aspect = mount.clientWidth / mount.clientHeight;
      current.camera.updateProjectionMatrix();
      current.renderer.setSize(mount.clientWidth, mount.clientHeight);
    }
    current.renderer.render(current.scene, current.camera);
  }, [mode, viewType]);

  /** 响应配置变更，实时更新模型几何与材质 */
  useEffect(() => {
    const p = partsRef.current;
    if (mode !== "preset" || !p || loadState !== "ready") return;

    // A. 长度缩放更新
    const lScale = config.lengthCm / 147;
    p.root.scale.setScalar(1);
    p.root.scale.z = lScale;

    // B. 应用涂装样式 (前节与后把)
    const finish =
      FINISH_STYLES[config.finishStyle] || FINISH_STYLES["matte-carbon"];
    setPartStyle(p.shaft, finish);
    setPartStyle(p.butt, finish);

    // C. 更新握把材质
    const wrap = WRAP_STYLES[config.wrapType];
    setPartStyle(p.grip, wrap);

    // D. 更新接牙材质
    const jointColor = config.jointType === "titanium" ? "#99ccaa" : "#bb88bb";
    setPartStyle(p.joint, { color: jointColor, rough: 0.1, metal: 0.9 });

    // 强制触发一次渲染以立即反馈
    sceneElements.current?.renderer.render(
      sceneElements.current.scene,
      sceneElements.current.camera,
    );
  }, [config, mode, loadState, modelRevision]);

  /** 提交订单逻辑 */
  const handleSubmit = async () => {
    if (!auth.isLoggedIn) return alert("请先登录");

    // 基础校验
    const { contactName, contactPhone, shippingAddress } = orderForm;
    if (!contactName || !contactPhone || !shippingAddress) {
      return alert("请完善联系信息");
    }

    try {
      const payload = {
        customization_mode: mode,
        contact_name: contactName,
        contact_phone: contactPhone,
        shipping_address: shippingAddress,
        ...(mode === "preset"
          ? { design_image_path: DEFAULT_IMAGE_PATH, config }
          : {
              design_description: freeform.designDescription,
              design_image_path: freeform.referenceImagePath,
            }),
      };

      await api.post("/orders/pool-cue", payload);
      alert("订单提交成功！");
    } catch (e) {
      console.error("订单提交失败:", e);
      alert("提交失败，请检查网络或联系客服");
    }
  };

  /** 图片上传处理 - 适配后端 API */
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 先创建本地临时预览
    const localPreviewUrl = URL.createObjectURL(file);
    setFreeform((prev) => ({
      ...prev,
      referenceImageName: file.name,
      referenceImageUrl: localPreviewUrl, // 临时使用本地 URL
    }));

    try {
      // 上传到您的后端
      const formData = new FormData();
      formData.append("image", file); // 字段名必须匹配 uploadImage.single("image")

      const res = await api.post("/images/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data.success) {
        // 替换为服务器 URL
        setFreeform((prev) => ({
          ...prev,
          referenceImagePath: res.data.path,
          referenceImageUrl: res.data.url,
        }));
      }
    } catch (error) {
      console.error("上传失败:", error);
      alert("图片上传失败，请重试");
    }
  };

  /** 清理临时 URL */
  useEffect(() => {
    return () => {
      // 注意：只清理 blob: URL，不清理 http: URL
      if (freeform.referenceImageUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(freeform.referenceImageUrl);
      }
    };
  }, [freeform.referenceImageUrl]);

  useEffect(() => {
    const image = imageRef.current;
    if (!image) return;

    const updateImageRenderSize = () => {
      setImageRenderSize({
        width: image.clientWidth,
        height: image.clientHeight,
      });
    };

    updateImageRenderSize();

    const observer = new ResizeObserver(updateImageRenderSize);
    observer.observe(image);

    return () => {
      observer.disconnect();
    };
  }, [viewType, mode]);

  const handleMagnifierMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = imageContainerRef.current;
    const image = imageRef.current;
    if (!container || !image) return;

    const containerRect = container.getBoundingClientRect();
    const imageRect = image.getBoundingClientRect();
    const lensRadius = MAGNIFIER_SIZE / 2;

    const pointerX = e.clientX - containerRect.left;
    const pointerY = e.clientY - containerRect.top;
    const relativeImageX = e.clientX - imageRect.left;
    const relativeImageY = e.clientY - imageRect.top;
    const imageLeft = imageRect.left - containerRect.left;
    const imageTop = imageRect.top - containerRect.top;
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
        e.clientX >= imageRect.left &&
        e.clientX <= imageRect.right &&
        e.clientY >= imageRect.top &&
        e.clientY <= imageRect.bottom,
    });
  };

  const handleMagnifierLeave = () => {
    setMagnifier((prev) => ({ ...prev, visible: false }));
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>碳纤维台球杆定制</h1>
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
        {/* 参数编辑区 */}
        <aside className={styles.panel}>
          {mode === "preset" ? (
            <div className={styles.controls}>
              <h2>配置参数</h2>
              <label>
                长度: {config.lengthCm}cm{" "}
                <input
                  type="range"
                  min="132"
                  max="160"
                  value={config.lengthCm}
                  onChange={(e) =>
                    setConfig({ ...config, lengthCm: +e.target.value })
                  }
                />
              </label>
              <label>
                重量: {config.weightOz}oz{" "}
                <input
                  type="range"
                  min="17"
                  max="21"
                  step="0.5"
                  value={config.weightOz}
                  onChange={(e) =>
                    setConfig({ ...config, weightOz: +e.target.value })
                  }
                />
              </label>
              <label>
                皮头直径: {config.tipDiameterMm}mm{" "}
                <input
                  type="range"
                  min="10"
                  max="13"
                  step="0.1"
                  value={config.tipDiameterMm}
                  onChange={(e) =>
                    setConfig({ ...config, tipDiameterMm: +e.target.value })
                  }
                />
              </label>
              <label>
                接牙类型:
                <select
                  value={config.jointType}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      jointType: e.target.value as JointType,
                    })
                  }
                >
                  <option value="stainless-steel">不锈钢</option>
                  <option value="titanium">钛合金 (+¥320)</option>
                </select>
              </label>
              <label>
                握把类型:
                <select
                  value={config.wrapType}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      wrapType: e.target.value as WrapType,
                    })
                  }
                >
                  <option value="carbon-grip">碳纤维握把</option>
                  <option value="genuine-leather">真皮握把 (+¥280)</option>
                  <option value="none">无握把 (光把)</option>
                </select>
              </label>
              <label>
                涂装:
                <select
                  value={config.finishStyle}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      finishStyle: e.target.value as FinishStyle,
                    })
                  }
                >
                  <option value="matte-carbon">磨砂碳纹</option>
                  <option value="gloss-carbon">高亮碳纹 (+¥260)</option>
                  <option value="ocean-blue">海洋蓝 (+¥260)</option>
                </select>
              </label>
              <label>
                球杆盒:
                <select
                  value={config.caseOption}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      caseOption: e.target.value as CaseOption,
                    })
                  }
                >
                  <option value="none">无</option>
                  <option value="basic">基础盒</option>
                  <option value="pro">专业硬壳盒 (+¥460)</option>
                </select>
              </label>
            </div>
          ) : (
            <div className={styles.freeform}>
              <h2>自由定制需求</h2>
              <textarea
                placeholder="描述您的设计想法...或是上传设计图"
                value={freeform.designDescription}
                onChange={(e) =>
                  setFreeform({
                    ...freeform,
                    designDescription: e.target.value,
                  })
                }
                rows={6}
              />
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  handleImageUpload(e);
                }}
              />
            </div>
          )}
        </aside>

        {/* 预览区：完全隔离逻辑 */}
        <section className={styles.previewPanel}>
          {mode === "preset" && (
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
          )}

          {mode === "preset" ? (
            <div className={styles.previewStack}>
              <div
                className={`${styles.preview} ${
                  viewType === "3d"
                    ? styles.activePreview
                    : styles.hiddenPreview
                }`}
                ref={previewRef}
              />

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
                    alt="台球杆 2D 预览"
                    className={styles.staticImage}
                    ref={imageRef}
                    onLoad={() =>
                      setImageRenderSize({
                        width: imageRef.current?.clientWidth ?? 0,
                        height: imageRef.current?.clientHeight ?? 0,
                      })
                    }
                  />
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
                        }px ${MAGNIFIER_SIZE / 2 - magnifier.sampleY * zoom}px`,
                      }}
                    >
                      <span className={styles.magnifierCrosshair} />
                    </div>
                  )}
                </div>
                <div className={styles.zoomControls}>
                  <span>弱</span>
                  <input
                    type="range"
                    min="1.6"
                    max="4"
                    step="0.1"
                    value={zoom}
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                  />
                  <span>强</span>
                  <button onClick={() => setZoom(2.2)}>重置</button>
                </div>
              </div>
            </div>
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

        {/* 价格与订单 */}
        <aside className={styles.pricePanel}>
          {mode === "preset" ? (
            <div className={styles.priceInfo}>
              <div className={styles.total}>
                {CURRENCY.format(pricing.total)}
              </div>
              <div className={styles.priceListTitle}>费用明细</div>
              <ul className={styles.priceList}>
                {pricing.lines.map((l) => (
                  <li key={l.label}>
                    <span className={styles.priceLabel}>{l.label}</span>
                    <span
                      className={`${styles.priceAmount} ${l.amount > 0 ? styles.positive : ""}`}
                    >
                      {CURRENCY.format(l.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className={styles.priceNotice}>价格：人工评估报价</div>
          )}

          <div className={styles.orderForm}>
            <input
              placeholder="联系人"
              value={orderForm.contactName}
              onChange={(e) =>
                setOrderForm({ ...orderForm, contactName: e.target.value })
              }
            />
            <input
              placeholder="电话"
              value={orderForm.contactPhone}
              onChange={(e) =>
                setOrderForm({ ...orderForm, contactPhone: e.target.value })
              }
            />
            <textarea
              placeholder="地址"
              value={orderForm.shippingAddress}
              onChange={(e) =>
                setOrderForm({ ...orderForm, shippingAddress: e.target.value })
              }
            />
            <button onClick={handleSubmit} className={styles.orderButton}>
              提交订单
            </button>
          </div>
        </aside>
      </div>
    </main>
  );
}
