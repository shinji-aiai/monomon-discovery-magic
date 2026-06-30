import { useLayoutEffect, useRef, useState } from "react";

/**
 * モノモン名を1行で美しく表示するためのコンポーネント。
 * - カード内で常に中央揃え
 * - 横幅が足りない場合は自動で文字サイズを少し縮小
 * - 2行折り返しはしない（必ず1行）
 * - 左右の余白が均等になり、どの名前でも表示位置が統一される
 */
export function AutoFitName({
  children,
  className = "",
  maxFontSize = 13,
  minFontSize = 8,
}: {
  children: React.ReactNode;
  className?: string;
  maxFontSize?: number;
  minFontSize?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [fontSize, setFontSize] = useState(maxFontSize);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const text = textRef.current;
    if (!container || !text) return;

    const fit = () => {
      let size = maxFontSize;
      text.style.fontSize = `${size}px`;
      const available = container.clientWidth;
      // 文字が収まるまで少しずつ縮小する
      while (size > minFontSize && text.scrollWidth > available) {
        size -= 0.5;
        text.style.fontSize = `${size}px`;
      }
      setFontSize(size);
    };

    fit();

    const ro = new ResizeObserver(fit);
    ro.observe(container);
    return () => ro.disconnect();
  }, [children, maxFontSize, minFontSize]);

  return (
    <div ref={containerRef} className={`w-full text-center ${className}`}>
      <span
        ref={textRef}
        className="inline-block max-w-full whitespace-nowrap align-middle"
        style={{ fontSize: `${fontSize}px` }}
      >
        {children}
      </span>
    </div>
  );
}
