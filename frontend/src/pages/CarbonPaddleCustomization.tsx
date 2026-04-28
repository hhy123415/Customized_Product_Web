import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import api from "../api/axios";
import styles from "../css/CarbonPaddleCustomization.module.css";
import { useAuth } from "../hooks/useAuth";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

// =================================================================
// 类型定义 (Types)
// =================================================================

type PaddleDiscipline = "sprint" | "marathon" | "touring";
type BladeShape = "teardrop" | "rectangular";
type ShaftFlex = "stiff" | "medium" | "soft";
type GripStyle = "ergonomic" | "straight" | "anti-slip";
type FinishStyle = "raw-carbon" | "satin-carbon" | "racing-red";
type AccessoryPack = "none" | "entry" | "pro";
type CustomizationMode = "preset" | "freeform";

interface PaddleConfig {
  lengthCm: number;
  bladeWidthCm: number;
  paddleWeightG: number;
  discipline: PaddleDiscipline;
  bladeShape: BladeShape;
  shaftFlex: ShaftFlex;
  gripStyle: GripStyle;
  finishStyle: FinishStyle;
  accessoryPack: AccessoryPack;
}

interface FreeformState {
  designDescription: string;
}

interface OrderFormState {
  contactName: string;
  contactPhone: string;
  shippingAddress: string;
}

/** 放大镜状态 */
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

/** 3D 模型部件引用 - 预留划船桨子节点名称 */
interface PaddleModelParts {
  root: THREE.Object3D;
  blade1?: THREE.Object3D;
  blade2?: THREE.Object3D;
  shaft1?: THREE.Object3D;
  shaft2?: THREE.Object3D;
  joint1?: THREE.Object3D;
  joint2?: THREE.Object3D;
}

// =================================================================
// 配置常量 (Constants)
// =================================================================

const MODEL_SOURCE = {
  url: "/models/paddle.glb", // 待替换实际划船桨模型
  lengthAxis: "y" as const,
  baseRotation: [0, 0, 0] as [number, number, number], // 根据实际模型方向调整
};

/** 涂装样式参数 */
const FINISH_STYLES: Record<
  FinishStyle,
  { color: string; rough: number; metal: number }
> = {
  "raw-carbon": { color: "#222222", rough: 0.8, metal: 0.1 },
  "satin-carbon": { color: "#3b424a", rough: 0.3, metal: 0.4 },
  "racing-red": { color: "#aa0033", rough: 0.15, metal: 0.5 },
};

const INITIAL_CONFIG: PaddleConfig = {
  lengthCm: 220,
  bladeWidthCm: 17,
  paddleWeightG: 640,
  discipline: "touring",
  bladeShape: "teardrop",
  shaftFlex: "medium",
  gripStyle: "ergonomic",
  finishStyle: "satin-carbon",
  accessoryPack: "entry",
};

const CURRENCY = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
  minimumFractionDigits: 0,
});

// =================================================================
// 工具函数 (Utilities)
// =================================================================

/** 递归查找节点（节点名不区分大小写） */
const findNode = (root: THREE.Object3D, name: string) => {
  let res: THREE.Object3D | undefined;
  root.traverse((n) => {
    if (!res && n.name.toLowerCase() === name.toLowerCase()) res = n;
  });
  return res;
};

/** 克隆材质，确保独立 */
const isolateMaterials = (part: THREE.Object3D | undefined) => {
  part?.traverse((node) => {
    if (node instanceof THREE.Mesh && node.material) {
      node.material = Array.isArray(node.material)
        ? node.material.map((m) => m.clone())
        : node.material.clone();
    }
  });
};

/** 应用材质样式 */
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

export default function CarbonPaddleCustomization() {
  const { auth } = useAuth();
  const [mode, setMode] = useState<CustomizationMode>("preset");
  const [config, setConfig] = useState<PaddleConfig>(INITIAL_CONFIG);
  const [freeform, setFreeform] = useState<FreeformState>({
    designDescription: "",
  });
  const [orderForm, setOrderForm] = useState<OrderFormState>({
    contactName: "",
    contactPhone: "",
    shippingAddress: "",
  });

  // ---- 预览相关状态 ----
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
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [modelRevision, setModelRevision] = useState(0);

  // Three.js 引用
  const previewRef = useRef<HTMLDivElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const partsRef = useRef<PaddleModelParts | null>(null);
  const sceneElements = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
  } | null>(null);

  // 2D 预览图路径（后续替换为真实划船桨图片）
  const IMAGE_2D_SOURCE = "/Carbon-Canoe-Paddle.jpg";
  const MAGNIFIER_SIZE = 170;

  // ---- 价格计算 ----
  const pricing = useMemo(() => {
    const lines = [{ label: "基础碳纤维划船桨", amount: 2680 }];
    lines.push({
      label: `长度定制(${config.lengthCm}cm)`,
      amount: (config.lengthCm - 220) * 28,
    });
    lines.push({
      label: `轻量化调校(${config.paddleWeightG}g)`,
      amount: Math.round((640 - config.paddleWeightG) * 2.5),
    });

    if (config.bladeShape === "rectangular") {
      lines.push({ label: "矩形桨叶升级", amount: 180 });
    }
    if (config.shaftFlex === "soft") {
      lines.push({ label: "柔性桨杆调校", amount: 220 });
    }
    if (config.gripStyle === "anti-slip") {
      lines.push({ label: "防滑握柄升级", amount: 140 });
    }
    if (config.finishStyle !== "raw-carbon") {
      lines.push({ label: "定制表面涂装", amount: 260 });
    }
    if (config.accessoryPack === "pro") {
      lines.push({ label: "专业附件包", amount: 420 });
    }

    return { lines, total: lines.reduce((sum, line) => sum + line.amount, 0) };
  }, [config]);

  // ---- 初始化 3D 场景与模型加载 ----
  useEffect(() => {
    if (mode !== "preset" || !previewRef.current) return;
    const mount = previewRef.current;

    // 1. 基础场景
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      45,
      mount.clientWidth / mount.clientHeight,
      0.1,
      100,
    );
    camera.position.set(1.2, 0.8, 1.5);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 0.5;
    controls.maxDistance = 4;
    controls.autoRotateSpeed = 1.0;

    // 2. 光照
    scene.add(
      new THREE.AmbientLight(0xffffff, 0.8),
      new THREE.DirectionalLight(0xffffff, 1),
    );

    const paddleGroup = new THREE.Group();
    paddleGroup.rotation.set(...MODEL_SOURCE.baseRotation);
    scene.add(paddleGroup);

    sceneElements.current = { renderer, scene, camera, controls };

    // 3. 加载模型
    new GLTFLoader().load(
      MODEL_SOURCE.url,
      (gltf) => {
        const root = gltf.scene;
        paddleGroup.add(root);

        const parts: PaddleModelParts = {
          root,
          blade1: findNode(root, "blade1"),
          blade2: findNode(root, "blade2"),
          shaft1: findNode(root, "shaft1"),
          shaft2: findNode(root, "shaft2"),
          joint1: findNode(root, "joint1"),
          joint2: findNode(root, "joint2"),
        };

        // 克隆子部件材质以独立控制
        if (parts.blade1) isolateMaterials(parts.blade1);
        if (parts.blade2) isolateMaterials(parts.blade2);
        if (parts.shaft1) isolateMaterials(parts.shaft1);
        if (parts.shaft2) isolateMaterials(parts.shaft2);
        if (parts.joint1) isolateMaterials(parts.joint1);
        if (parts.joint2) isolateMaterials(parts.joint2);

        partsRef.current = parts;
        setLoadState("ready");
        setModelRevision((prev) => prev + 1);
      },
      undefined,
      () => setLoadState("error"),
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
      // eslint-disable-next-line react-hooks/exhaustive-deps
      mount.removeChild(renderer.domElement);
    };
  }, [mode]);

  // 当 viewType 或 mode 变化时同步 controls 及相机比例
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

  // ---- 响应配置变更，更新模型材质与缩放 ----
  useEffect(() => {
    const parts = partsRef.current;
    if (mode !== "preset" || !parts || loadState !== "ready") return;

    // 长度缩放 (假设模型原始尺寸对应 220cm)
    const lengthScale = config.lengthCm / 220;
    parts.root.scale.set(1, 1, 1);
    if (MODEL_SOURCE.lengthAxis === "y") {
      parts.root.scale.y = lengthScale;
    }

    // 涂装颜色应用到 blade 和 shaft
    const finish =
      FINISH_STYLES[config.finishStyle] || FINISH_STYLES["raw-carbon"];
    setPartStyle(parts.blade1, finish);
    setPartStyle(parts.shaft1, finish);
    setPartStyle(parts.blade2, finish);
    setPartStyle(parts.shaft2, finish);

    // 强制渲染
    sceneElements.current?.renderer.render(
      sceneElements.current.scene,
      sceneElements.current.camera,
    );
  }, [config, mode, loadState, modelRevision]);

  // ---- 订单提交 ----
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
              config,
            }
          : {
              customization_mode: "freeform",
              contact_name: contactName,
              contact_phone: contactPhone,
              shipping_address: shippingAddress,
              design_description: freeform.designDescription,
              design_image_path: null,
            };

      await api.post("/orders/carbon-paddle", payload);
      alert("订单提交成功！");
    } catch (error) {
      console.error("submit carbon paddle order failed:", error);
      alert("提交失败，请检查网络或稍后重试");
    }
  };

  // ---- 2D 图片相关逻辑 ----
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

  // ---- JSX ----
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>碳纤维划船桨定制</h1>
        <p>
          参考台球杆定制流程，当前 3D/2D
          资源暂用占位文件，后续仅需替换真实划船桨模型与图片即可。
        </p>
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
            自由方案
          </button>
        </div>
      </header>

      <div className={styles.layout}>
        <aside className={styles.panel}>
          {mode === "preset" ? (
            <div className={styles.controls}>
              <h2>基础参数</h2>
              <label>
                适用项目:
                <select
                  value={config.discipline}
                  onChange={(event) =>
                    setConfig({
                      ...config,
                      discipline: event.target.value as PaddleDiscipline,
                    })
                  }
                >
                  <option value="sprint">竞速冲刺</option>
                  <option value="marathon">长距离马拉松</option>
                  <option value="touring">综合巡航</option>
                </select>
              </label>
              <label>
                总长度: {config.lengthCm} cm
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
                桨叶宽度: {config.bladeWidthCm} cm
                <input
                  type="range"
                  min="15"
                  max="21"
                  step="0.5"
                  value={config.bladeWidthCm}
                  onChange={(event) =>
                    setConfig({
                      ...config,
                      bladeWidthCm: Number(event.target.value),
                    })
                  }
                />
              </label>
              <label>
                整桨重量: {config.paddleWeightG} g
                <input
                  type="range"
                  min="560"
                  max="760"
                  step="10"
                  value={config.paddleWeightG}
                  onChange={(event) =>
                    setConfig({
                      ...config,
                      paddleWeightG: Number(event.target.value),
                    })
                  }
                />
              </label>
              <label>
                桨叶形状:
                <select
                  value={config.bladeShape}
                  onChange={(event) =>
                    setConfig({
                      ...config,
                      bladeShape: event.target.value as BladeShape,
                    })
                  }
                >
                  <option value="teardrop">水滴形</option>
                  <option value="rectangular">矩形高抓水</option>
                </select>
              </label>
              <label>
                桨杆弹性:
                <select
                  value={config.shaftFlex}
                  onChange={(event) =>
                    setConfig({
                      ...config,
                      shaftFlex: event.target.value as ShaftFlex,
                    })
                  }
                >
                  <option value="stiff">硬弹性</option>
                  <option value="medium">中弹性</option>
                  <option value="soft">柔弹性 (+¥220)</option>
                </select>
              </label>
              <label>
                握柄结构:
                <select
                  value={config.gripStyle}
                  onChange={(event) =>
                    setConfig({
                      ...config,
                      gripStyle: event.target.value as GripStyle,
                    })
                  }
                >
                  <option value="ergonomic">人体工学</option>
                  <option value="straight">直柄</option>
                  <option value="anti-slip">防滑包覆 (+¥140)</option>
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
                  <option value="raw-carbon">原生碳纹</option>
                  <option value="satin-carbon">缎面碳纹 (+¥260)</option>
                  <option value="racing-red">竞速红涂装 (+¥260)</option>
                </select>
              </label>
              <label>
                附件包:
                <select
                  value={config.accessoryPack}
                  onChange={(event) =>
                    setConfig({
                      ...config,
                      accessoryPack: event.target.value as AccessoryPack,
                    })
                  }
                >
                  <option value="none">无</option>
                  <option value="entry">基础保养包</option>
                  <option value="pro">专业附件包 (+¥420)</option>
                </select>
              </label>
            </div>
          ) : (
            <div className={styles.freeform}>
              <h2>自由定制需求</h2>
              <textarea
                rows={6}
                placeholder="描述您的桨叶结构、编织方向、品牌图案或使用场景..."
                value={freeform.designDescription}
                onChange={(event) =>
                  setFreeform({
                    ...freeform,
                    designDescription: event.target.value,
                  })
                }
              />
            </div>
          )}
        </aside>

        {/* ---- 预览区域 ---- */}
        <section className={styles.previewPanel}>
          {mode === "preset" ? (
            <>
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
                {/* 3D 视图 */}
                <div
                  className={`${styles.preview} ${
                    viewType === "3d"
                      ? styles.activePreview
                      : styles.hiddenPreview
                  }`}
                  ref={previewRef}
                />
                {/* 2D 视图 */}
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
                      alt="划船桨 2D 预览"
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
            </>
          ) : (
            <div className={styles.freeformPreview}>
              <h2>自由方案预览</h2>
              <div className={styles.imagePreviewContainer}>
                <img
                  src={IMAGE_2D_SOURCE}
                  alt="自由方案占位预览"
                  className={styles.previewImage}
                />
              </div>
              <p className={styles.imageCaption}>
                当前使用占位图，后续将支持上传设计草图或效果图预览。
              </p>
            </div>
          )}
        </section>

        <aside className={styles.pricePanel}>
          {mode === "preset" ? (
            <div className={styles.priceInfo}>
              <div className={styles.total}>
                {CURRENCY.format(pricing.total)}
              </div>
              <ul className={styles.priceList}>
                {pricing.lines.map((line) => (
                  <li key={line.label}>
                    <span>{line.label}</span>
                    <span>{CURRENCY.format(line.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className={styles.priceNotice}>价格将由人工评估后报价</div>
          )}

          <div className={styles.orderForm}>
            <h2>联系信息</h2>
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
              placeholder="收货地址"
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
