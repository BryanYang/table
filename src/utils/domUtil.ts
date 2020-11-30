// 获取第一个可以滚动的父元素
export function getScrollParent(node: Node) {
  if (node == null) {
    return null;
  }

  if ((node as HTMLElement).scrollHeight > (node as HTMLElement).clientHeight + 1) {
    // if (node.scrollHeight === node.parentNode?.scrollHeight) {
    //   return getScrollParent(node.parentNode);
    // }
    return node;
  }
  return getScrollParent(node.parentNode);
}
