import React, { useEffect, useRef, useState } from "react";
import { Application, Ticker } from "pixi.js";
import { Live2DSprite, Config } from "easy-live2d";
import style from "../css/Live2D.module.css";
import { Power, PowerOff, MessageCircle, MessageSquareOff } from "lucide-react";
import api from "../api/axios";

// Markdown 渲染相关导入
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css"; // 引入 KaTeX 样式
import type { Components } from "react-markdown";
import type { ReactNode, HTMLAttributes } from "react";

const Live2DViewer: React.FC = () => {
  const [isVisible, setIsVisible] = useState(true);
  const [isChatVisible, setIsChatVisible] = useState(true); // 控制对话显示/隐藏
  const [inputText, setInputText] = useState("");
  const [replyText, setReplyText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<Application | null>(null);
  const spriteRef = useRef<Live2DSprite | null>(null);

  useEffect(() => {
    const init = async () => {
      if (!canvasRef.current || appRef.current) return;

      Config.MotionGroupIdle = "Idle";
      Config.MouseFollow = true;

      const app = new Application();
      await app.init({
        view: canvasRef.current,
        backgroundAlpha: 0, // 确保背景透明
        width: 200,
        height: 250,
        antialias: true,
      });
      appRef.current = app;

      Ticker.targetFPMS = 0.144;

      const sprite = new Live2DSprite();
      await sprite.init({
        modelPath: "/Resources/mao_pro_zh/runtime/mao_pro.model3.json",
        ticker: Ticker.shared,
      });
      spriteRef.current = sprite;

      sprite.width = canvasRef.current.clientWidth * window.devicePixelRatio;
      sprite.height = canvasRef.current.clientHeight * window.devicePixelRatio;
      sprite.x = 0;

      app.stage.addChild(sprite);

      sprite.onLive2D("hit", ({ hitAreaName }) => {
        if (hitAreaName.includes("Body")) {
          sprite.startRandomMotion({ group: "Motion", priority: 2 });
        } else {
          sprite.startRandomMotion({ group: "Sp-Motion", priority: 3 });
        }
      });

      console.log("live2d init success");
    };

    init();

    return () => {
      if (appRef.current) {
        appRef.current.destroy(true, { children: true, texture: true });
        appRef.current = null;
      }
    };
  }, []);

  const handleSendMessage = async () => {
    if (!inputText.trim() || isTyping) return;

    const userMsg = inputText;
    setInputText("");
    setReplyText("");
    setIsTyping(true);

    try {
      const response = await fetch(`${api.defaults.baseURL}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMsg,
          conversation_id: conversationId,
        }),
        credentials: api.defaults.withCredentials ? "include" : "same-origin",
      });

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let accumulatedText = "";

      if (reader) {
        while (!done) {
          const { value, done: doneReading } = await reader.read();
          done = doneReading;
          const chunkValue = decoder.decode(value);

          const lines = chunkValue.split("\n");
          for (const line of lines) {
            if (line.startsWith("data:")) {
              try {
                const data = JSON.parse(line.slice(5));
                if (data.conversation_id && !conversationId) {
                  setConversationId(data.conversation_id);
                  localStorage.setItem("l2d_conv_id", data.conversation_id);
                }
                if (
                  data.event === "message" ||
                  data.event === "agent_message"
                ) {
                  accumulatedText += data.answer;
                  setReplyText(accumulatedText);

                  if (accumulatedText.length % 20 === 0) {
                    spriteRef.current?.startRandomMotion({
                      group: "Motion",
                      priority: 2,
                    });
                  }
                }
              } catch (e) {
                console.log(e);
              }
            }
          }
        }
      }
    } catch (error) {
      console.log(error);
      setReplyText("哎呀，出错了...");
    } finally {
      setIsTyping(false);
    }
  };

  const startNewChat = () => {
    setConversationId(null);
    setReplyText("你好！让我们开始新的话题吧。");
  };

  // 切换对话显示/隐藏
  const toggleChatVisibility = () => {
    setIsChatVisible(!isChatVisible);
  };

  interface CodeProps extends HTMLAttributes<HTMLElement> {
    inline?: boolean;
    children?: ReactNode;
  }

  // 自定义 Markdown 组件配置
  const markdownComponents: Components = {
    // 自定义代码块样式
    code: ({ inline, className, children, ...props }: CodeProps) => {
      const match = /language-(\w+)/.exec(className || "");
      return !inline && match ? (
        <pre className={style["code-block"]}>
          <code className={className} {...props}>
            {children}
          </code>
        </pre>
      ) : (
        <code className={style["inline-code"]} {...props}>
          {children}
        </code>
      );
    },
  };

  return (
    <div className={style["live2d-container"]}>
      {/* 始终渲染画布区域，通过 hidden 类控制可见性 */}
      <div
        className={`${style["canvas-area"]} ${!isVisible ? style.hidden : ""}`}
      >
        {/* 聊天界面 - hover时显示 */}
        <div className={style["chat-interface"]}>
          <div className={style["chat-bubble-container"]}>
            {/* 新对话按钮 */}
            {conversationId && (
              <button className={style["new-chat-btn"]} onClick={startNewChat}>
                新对话
              </button>
            )}

            {/* 切换对话显示按钮 */}
            <button
              className={`${style["toggle-chat-btn"]} ${!isChatVisible ? style["hidden-state"] : ""}`}
              onClick={toggleChatVisibility}
              title={isChatVisible ? "隐藏对话" : "显示对话"}
            >
              {isChatVisible ? (
                <MessageSquareOff size={16} />
              ) : (
                <MessageCircle size={16} />
              )}
            </button>

            {/* 对话气泡 - 根据 isChatVisible 控制显示 */}
            {(replyText || isTyping) && isChatVisible && (
              <div className={style["chat-bubble"]}>
                {isTyping && !replyText ? (
                  <div className={style["typing-indicator"]}>
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                ) : (
                  <div className={style["markdown-content"]}>
                    <ReactMarkdown
                      remarkPlugins={[remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                      components={markdownComponents}
                    >
                      {replyText}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            )}

            {/* 对话隐藏提示 */}
            {!isChatVisible && (
              <div className={style["chat-hidden-hint"]}>对话已隐藏</div>
            )}
          </div>
        </div>

        {/* 画布包装器 */}
        <div className={style["canvas-wrapper"]}>
          <button
            className={style["close-btn"]}
            onClick={() => setIsVisible(false)}
            title="关闭助手"
          >
            <PowerOff size={16} />
          </button>
          <canvas ref={canvasRef} className={style["live2d-canvas"]} />
        </div>

        {/* 输入框 - hover时显示 */}
        <div className={style["input-box"]}>
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
            placeholder={isTyping ? "正在输入..." : "和猫说点什么..."}
            disabled={isTyping}
          />
          <button onClick={handleSendMessage} disabled={isTyping}>
            {isTyping ? "..." : "发送"}
          </button>
        </div>
      </div>

      {/* 召唤标签 */}
      <div
        className={`${style["summon-tag"]} ${isVisible ? style.hidden : ""}`}
        onClick={() => setIsVisible(true)}
      >
        <Power size={20} />
        <span>呼叫助手</span>
      </div>
    </div>
  );
};

export default Live2DViewer;
