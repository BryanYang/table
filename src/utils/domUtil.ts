/* eslint-disable no-param-reassign */
/* eslint-disable no-unused-expressions */
// 获取第一个可以滚动的父元素
export function getScrollParent(node: Element) {
  if (node == null) {
    return null;
  }

  if (node === document.body) {
    return node;
  }

  if (node.scrollTop > 0) {
    return node;
  }

  node.scrollTop += 1;
  const top = node.scrollTop;
  if (top > 0) {
    return node;
  }
  return getScrollParent(node.parentElement);
}
