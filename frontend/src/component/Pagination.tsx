import React from "react";
import styles from "../css/Pagination.module.css";

interface PaginationProps {
  current: number;        // 当前页码
  total: number;          // 总页数
  onPageChange: (page: number) => void;
  siblingCount?: number;  // 当前页两侧显示页码数，默认 1
}

const Pagination: React.FC<PaginationProps> = ({
  current,
  total,
  onPageChange,
  siblingCount = 1,
}) => {
  // 生成页码数组
  const range = (start: number, end: number) =>
    Array.from({ length: end - start + 1 }, (_, i) => start + i);

  const generatePages = () => {
    const totalNumbers = siblingCount * 2 + 5; // 首尾+当前+省略号占位
    if (total <= totalNumbers) {
      return range(1, total);
    }

    const leftSiblingIndex = Math.max(current - siblingCount, 1);
    const rightSiblingIndex = Math.min(current + siblingCount, total);

    const showLeftDots = leftSiblingIndex > 2;
    const showRightDots = rightSiblingIndex < total - 1;

    if (!showLeftDots && showRightDots) {
      const leftCount = 3 + 2 * siblingCount;
      return [...range(1, leftCount), "...", total];
    }

    if (showLeftDots && !showRightDots) {
      const rightCount = 3 + 2 * siblingCount;
      return [1, "...", ...range(total - rightCount + 1, total)];
    }

    return [
      1,
      "...",
      ...range(leftSiblingIndex, rightSiblingIndex),
      "...",
      total,
    ];
  };

  const pages = generatePages();

  if (total <= 1) return null; // 只有一页时不显示

  return (
    <nav className={styles.pagination} aria-label="分页导航">
      <button
        className={styles.pageButton}
        disabled={current === 1}
        onClick={() => onPageChange(current - 1)}
      >
        上一页
      </button>

      {pages.map((page, index) =>
        typeof page === "number" ? (
          <button
            key={index}
            className={`${styles.pageButton} ${
              page === current ? styles.active : ""
            }`}
            onClick={() => onPageChange(page)}
          >
            {page}
          </button>
        ) : (
          <span key={index} className={styles.ellipsis}>
            ...
          </span>
        ),
      )}

      <button
        className={styles.pageButton}
        disabled={current === total}
        onClick={() => onPageChange(current + 1)}
      >
        下一页
      </button>
    </nav>
  );
};

export default Pagination;