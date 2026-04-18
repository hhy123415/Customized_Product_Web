import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import api from "../api/axios";
import styles from "../css/PoolCueCustomization.module.css";
import { useAuth } from "../hooks/useAuth";

// ==================== 类型定义 ====================

type JointType = "stainless-steel" | "titanium";
type WrapType = "carbon-grip" | "genuine-leather" | "none";
type CaseOption = "none" | "basic" | "pro";
type FinishStyle =
  | "matte-carbon" // 磨砂碳纹
  | "gloss-carbon" // 高亮碳纹
  | "ocean-blue"; // 海洋蓝

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

/** 球杆部件映射引用 */
interface CueModelParts {
  root: THREE.Object3D;
  tip?: THREE.Object3D;
  ferrule?: THREE.Object3D;
  shaft?: THREE.Object3D;
  joint?: THREE.Object3D;
  grip?: THREE.Object3D;
  butt?: THREE.Object3D;
}

// ==================== 常量与工具 ====================

const MODEL_SOURCE = {
  url: "/models/cue-carbon.glb",
  lengthAxis: "y" as const,
  baseRotation: [0, 0, -Math.PI / 2] as [number, number, number],
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

/** 递归查找模型节点 */
const findNode = (root: THREE.Object3D, name: string) => {
  let res: THREE.Object3D | undefined;
  root.traverse((n) => {
    if (!res && n.name.toLowerCase() === name.toLowerCase()) res = n;
  });
  return res;
};

/** 隔离材质实例，防止多个部件共享材质导致的变色冲突 */
const isolateMaterials = (part: THREE.Object3D | undefined) => {
  part?.traverse((node) => {
    if (node instanceof THREE.Mesh && node.material) {
      if (Array.isArray(node.material)) {
        node.material = node.material.map((m) => m.clone());
      } else {
        node.material = node.material.clone();
      }
    }
  });
};

/** 设置部件材质颜色、粗糙度和金属度 */
const setPartStyle = (
  part: THREE.Object3D | undefined,
  color: string,
  rough = 0.5,
  metal = 0.2,
) => {
  part?.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      const mats = Array.isArray(node.material)
        ? node.material
        : [node.material];
      mats.forEach((m) => {
        if (m instanceof THREE.MeshStandardMaterial) {
          m.color.set(color);
          m.roughness = rough;
          m.metalness = metal;
        }
      });
    }
  });
};

// ==================== 主组件 ====================

export default function PoolCueCustomization() {
  const { auth } = useAuth();
  const [mode, setMode] = useState<"preset" | "freeform">("preset");
  const [config, setConfig] = useState(INITIAL_CONFIG);
  // 自由定制状态
  const [freeform, setFreeform] = useState({
    designDescription: "",
    referenceImagePath: "", // 服务器返回的相对路径 /uploads/xxx.jpg
    referenceImageUrl: "", // 新增：完整的预览 URL
    referenceImageName: "",
  });
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [orderForm, setOrderForm] = useState<OrderFormState>({
    contactName: "",
    contactPhone: "",
    shippingAddress: "",
  });

  // Refs: 存储 Three.js 实例
  const previewRef = useRef<HTMLDivElement>(null);
  const partsRef = useRef<CueModelParts | null>(null);
  const sceneElements = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
  } | null>(null);

  // 1. 价格计算逻辑 (仅在参数模式下计算)
  const pricing = useMemo(() => {
    const lines = [{ label: "基础杆体", amount: 1880 }];
    lines.push({
      label: `长度调整(${config.lengthCm}cm)`,
      amount: (config.lengthCm - 147) * 26,
    });
    lines.push({
      label: `重量调整(${config.weightOz}oz)`,
      amount: Math.round((config.weightOz - 19) * 80),
    });
    if (config.jointType === "titanium")
      lines.push({ label: "钛合金接牙", amount: 320 });
    if (config.wrapType === "genuine-leather")
      lines.push({ label: "真皮握把", amount: 280 });
    if (config.finishStyle !== "matte-carbon")
      lines.push({ label: "特殊涂装", amount: 260 });
    if (config.caseOption === "pro")
      lines.push({ label: "专业硬壳盒", amount: 460 });
    return { lines, total: lines.reduce((s, i) => s + i.amount, 0) };
  }, [config]);

  // 初始化 Three.js 场景
  useEffect(() => {
    if (!previewRef.current) return;
    const mount = previewRef.current;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      45,
      mount.clientWidth / mount.clientHeight,
      0.1,
      100,
    );
    camera.position.set(0.5, 0.3, 0.8);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    // 灯光与地面
    scene.add(
      new THREE.AmbientLight(0xffffff, 0.8),
      new THREE.DirectionalLight(0xffffff, 1),
    );
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(2, 32),
      new THREE.MeshStandardMaterial({ color: "#eee" }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.1;
    scene.add(floor);

    const cueGroup = new THREE.Group();
    cueGroup.rotation.set(...MODEL_SOURCE.baseRotation);
    scene.add(cueGroup);

    sceneElements.current = { renderer, scene, camera };

    // 加载模型
    new GLTFLoader().load(MODEL_SOURCE.url, (gltf) => {
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
        (part) => part && isolateMaterials(part as THREE.Object3D),
      );
      setLoadState("ready");
    });

    // 动画循环
    let frameId: number;
    const animate = () => {
      // 优化：仅在 preset 模式下旋转和渲染，节省资源
      if (mode === "preset") {
        cueGroup.rotation.y += 0.005;
        renderer.render(scene, camera);
      }
      frameId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [mode]); // 当模式切换时，Effect 会重新评估渲染逻辑

  // 当配置改变时更新 3D 模型材质与几何
  useEffect(() => {
    const p = partsRef.current;
    if (mode !== "preset" || !p || loadState !== "ready") return;

    // 长度缩放
    p.root.scale.setScalar(1);
    const lScale = config.lengthCm / 147;
    if (MODEL_SOURCE.lengthAxis === "y") p.root.scale.y = lScale;

    // ===== 修改：3种材质切换逻辑 =====
    let mainColor: string;
    let mainRough: number;
    let mainMetal: number;

    switch (config.finishStyle) {
      case "matte-carbon":
        mainColor = "#3b424a"; // 深灰
        mainRough = 0.6; // 高粗糙 = 哑光
        mainMetal = 0.1;
        break;
      case "gloss-carbon":
        mainColor = "#2f3840"; // 深灰
        mainRough = 0.1; // 低粗糙 = 高光
        mainMetal = 0.3;
        break;
      case "ocean-blue":
        mainColor = "#0066cc"; // 亮蓝
        mainRough = 0.15; // 光滑
        mainMetal = 0.1;
        break;
      default:
        mainColor = "#3b424a";
        mainRough = 0.5;
        mainMetal = 0.2;
    }

    // 同时应用到 shaft 和 butt
    setPartStyle(p.shaft, mainColor, mainRough, mainMetal);
    setPartStyle(p.butt, mainColor, mainRough, mainMetal);

    setPartStyle(
      p.joint,
      config.jointType === "titanium" ? "#9ca" : "#b8b",
      0.2,
      0.8,
    );
    setPartStyle(
      p.grip,
      config.wrapType === "genuine-leather" ? "#3e2a1f" : "#222",
      0.8,
      0,
    );

    sceneElements.current?.renderer.render(
      sceneElements.current.scene,
      sceneElements.current.camera,
    );
  }, [config, mode, loadState]);

  // 提交订单逻辑
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
          ? { config }
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

  // 图片上传处理 - 适配后端 API
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
          referenceImagePath: res.data.path, // /uploads/xxx.jpg
          referenceImageUrl: res.data.url, // http://host/uploads/xxx.jpg
        }));
      }
    } catch (error) {
      console.error("上传失败:", error);
      alert("图片上传失败，请重试");
    }
  };

  // 清理临时 URL
  useEffect(() => {
    return () => {
      // 注意：只清理 blob: URL，不清理 http: URL
      if (freeform.referenceImageUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(freeform.referenceImageUrl);
      }
    };
  }, [freeform.referenceImageUrl]);

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
                  min="142"
                  max="150"
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
                placeholder="描述您的设计想法..."
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
          {mode === "preset" ? (
            <div className={styles.preview} ref={previewRef} />
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
              <ul>
                {pricing.lines.map((l) => (
                  <li key={l.label}>
                    {l.label}: {CURRENCY.format(l.amount)}
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
