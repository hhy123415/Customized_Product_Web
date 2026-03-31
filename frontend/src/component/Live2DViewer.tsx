import React, { useEffect, useRef, useState } from "react";
import { Application, Ticker } from "pixi.js";
import { Live2DSprite, Config } from "easy-live2d";
import style from "../css/Live2D.module.css";
import { Power, PowerOff, MessageCircle, MessageSquareOff } from "lucide-react";
import api from "../api/axios";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import type { Components } from "react-markdown";
import type { ReactNode, HTMLAttributes } from "react";

const DEFAULT_ERROR_TEXT = "哎呀，出错了。";
const NEW_CHAT_TEXT = "你好！让我们开始一个新话题吧。";

const Live2DViewer: React.FC = () => {
  const [isVisible, setIsVisible] = useState(true);
  const [isChatVisible, setIsChatVisible] = useState(true);
  const [inputText, setInputText] = useState("");
  const [replyText, setReplyText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(() =>
    localStorage.getItem("l2d_conv_id"),
  );

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
        backgroundAlpha: 0,
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

      console.log("live2d 初始化成功");
    };

    init();

    return () => {
      if (appRef.current) {
        appRef.current.destroy(true, { children: true, texture: true });
        appRef.current = null;
      }
    };
  }, []);

  const parseErrorResponse = async (response: Response) => {
    let errorMessage = `请求失败，状态码 ${response.status}`;

    try {
      const errorData = await response.json();
      if (typeof errorData?.details === "string" && errorData.details) {
        return errorData.details;
      }
      if (typeof errorData?.error === "string" && errorData.error) {
        return errorData.error;
      }
      if (typeof errorData?.message === "string" && errorData.message) {
        return errorData.message;
      }
    } catch {
      try {
        const errorText = await response.text();
        if (errorText) {
          errorMessage = errorText;
        }
      } catch {
        // Keep the fallback message.
      }
    }

    return errorMessage;
  };

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
        throw new Error(await parseErrorResponse(response));
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("聊天响应体为空");
      }

      const decoder = new TextDecoder();
      let done = false;
      let buffer = "";
      let accumulatedText = "";

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        buffer += decoder.decode(value, { stream: !doneReading });

        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const eventChunk of events) {
          const dataLines = eventChunk
            .split("\n")
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trim())
            .filter(Boolean);

          if (!dataLines.length) {
            continue;
          }

          try {
            const data = JSON.parse(dataLines.join("\n"));

            if (data.conversation_id) {
              setConversationId(data.conversation_id);
              localStorage.setItem("l2d_conv_id", data.conversation_id);
            }

            if (
              (data.event === "message" || data.event === "agent_message") &&
              typeof data.answer === "string"
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
            console.log("解析 SSE 数据失败:", e, eventChunk);
          }
        }
      }

      if (!accumulatedText.trim()) {
        throw new Error(
          "Dify 未返回可见答案。请检查后端 /api/chat 的日志。",
        );
      }
    } catch (error) {
      console.log(error);
      setReplyText(error instanceof Error ? error.message : DEFAULT_ERROR_TEXT);
    } finally {
      setIsTyping(false);
    }
  };

  const startNewChat = () => {
    setConversationId(null);
    localStorage.removeItem("l2d_conv_id");
    setReplyText(NEW_CHAT_TEXT);
  };

  const toggleChatVisibility = () => {
    setIsChatVisible(!isChatVisible);
  };

  interface CodeProps extends HTMLAttributes<HTMLElement> {
    inline?: boolean;
    children?: ReactNode;
  }

  const markdownComponents: Components = {
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
      <div
        className={`${style["canvas-area"]} ${!isVisible ? style.hidden : ""}`}
      >
        <div className={style["chat-interface"]}>
          <div className={style["chat-bubble-container"]}>
            {conversationId && (
              <button className={style["new-chat-btn"]} onClick={startNewChat}>
                新对话
              </button>
            )}

            <button
              className={`${style["toggle-chat-btn"]} ${!isChatVisible ? style["hidden-state"] : ""}`}
              onClick={toggleChatVisibility}
              title={isChatVisible ? "隐藏聊天" : "显示聊天"}
            >
              {isChatVisible ? (
                <MessageSquareOff size={16} />
              ) : (
                <MessageCircle size={16} />
              )}
            </button>

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

            {!isChatVisible && (
              <div className={style["chat-hidden-hint"]}>Chat hidden</div>
            )}
          </div>
        </div>

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

        <div className={style["input-box"]}>
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
            placeholder={isTyping ? "思考中..." : "说点什么..."}
            disabled={isTyping}
          />
          <button onClick={handleSendMessage} disabled={isTyping}>
            {isTyping ? "..." : "发送"}
          </button>
        </div>
      </div>

      <div
        className={`${style["summon-tag"]} ${isVisible ? style.hidden : ""}`}
        onClick={() => setIsVisible(true)}
      >
        <Power size={20} />
        <span>打开助手</span>
      </div>
    </div>
  );
};

export default Live2DViewer;
