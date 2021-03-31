import * as React from 'react';
import addEventListener from 'rc-util/lib/Dom/addEventListener';
// import getScrollBarSize from 'rc-util/lib/getScrollBarSize';
import classNames from 'classnames';
import { getOffset } from 'rc-util/lib/Dom/css';
import TableContext from './context/TableContext';
import { useFrameState } from './hooks/useFrame';
import { getScrollParent } from './utils/domUtil';

interface StickyScrollBarProps {
  scrollBodyRef: React.RefObject<HTMLDivElement>;
  onScroll: (params: { scrollLeft?: number }) => void;
  offsetScroll: number;
  scrollbarSize: number;
}

const StickyScrollBar: React.ForwardRefRenderFunction<unknown, StickyScrollBarProps> = (
  { scrollBodyRef, onScroll, offsetScroll, scrollbarSize },
  ref,
) => {
  const { prefixCls } = React.useContext(TableContext);
  const bodyScrollWidth = scrollBodyRef.current?.scrollWidth || 0;
  const bodyWidth = scrollBodyRef.current?.clientWidth || 0;
  const scrollBarWidth = bodyScrollWidth && bodyWidth * (bodyWidth / bodyScrollWidth);

  const scrollBarRef = React.useRef<HTMLDivElement>();
  const [frameState, setFrameState] = useFrameState<{
    scrollLeft: number;
    isHiddenScrollBar: boolean;
    translateY: number;
  }>({
    scrollLeft: 0,
    isHiddenScrollBar: false,
    translateY: 0,
  });
  const refState = React.useRef<{
    delta: number;
    x: number;
  }>({
    delta: 0,
    x: 0,
  });
  const [isActive, setActive] = React.useState(false);
  const [firstSrcollParent, setFirstScrollParent] = React.useState<HTMLDivElement>();
  // const [translateY, setTranslateY] = React.useState(0);

  const onMouseUp: React.MouseEventHandler<HTMLDivElement> = () => {
    setActive(false);
  };

  const onMouseDown: React.MouseEventHandler<HTMLDivElement> = event => {
    event.persist();
    refState.current.delta = event.pageX - frameState.scrollLeft;
    refState.current.x = 0;
    setActive(true);
    event.preventDefault();
  };

  const onMouseMove: React.MouseEventHandler<HTMLDivElement> = event => {
    // https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/buttons
    const { buttons } = event || (window?.event as any);
    if (!isActive || buttons === 0) {
      // If out body mouse up, we can set isActive false when mouse move
      if (isActive) {
        setActive(false);
      }
      return;
    }
    let left: number =
      refState.current.x + event.pageX - refState.current.x - refState.current.delta;

    if (left <= 0) {
      left = 0;
    }

    if (left + scrollBarWidth >= bodyWidth) {
      left = bodyWidth - scrollBarWidth;
    }

    onScroll({
      scrollLeft: (left / bodyWidth) * (bodyScrollWidth + 2),
    });

    refState.current.x = event.pageX;
  };

  const onContainerScroll = () => {
    const tableOffsetTop = getOffset(scrollBodyRef.current).top;
    const tableBottomOffset = tableOffsetTop + scrollBodyRef.current.offsetHeight;
    const currentClientOffset = document.documentElement.scrollTop + window.innerHeight;

    if (
      tableBottomOffset - scrollbarSize <= currentClientOffset ||
      tableOffsetTop >= currentClientOffset - offsetScroll
    ) {
      setFrameState(state => ({
        ...state,
        isHiddenScrollBar: true,
        translateY: 0,
      }));
    } else {
      setFrameState(state => ({
        ...state,
        isHiddenScrollBar: false,
        translateY: currentClientOffset - tableBottomOffset - scrollbarSize * 2,
      }));
    }
  };

  const setScrollLeft = (left: number) => {
    setFrameState(state => {
      return {
        ...state,
        scrollLeft: (left / bodyScrollWidth) * bodyWidth || 0,
      };
    });
  };

  React.useImperativeHandle(ref, () => ({
    setScrollLeft,
  }));

  React.useEffect(() => {
    const onMouseUpListener = addEventListener(document.body, 'mouseup', onMouseUp, false);
    const onMouseMoveListener = addEventListener(document.body, 'mousemove', onMouseMove, false);
    onContainerScroll();
    return () => {
      onMouseUpListener.remove();
      onMouseMoveListener.remove();
    };
  }, [scrollBarWidth, isActive]);

  React.useEffect(() => {
    const parent = firstSrcollParent;
    if (firstSrcollParent) {
      const onScrollListener = addEventListener(parent, 'scroll', onContainerScroll, false);
      const onResizeListener = addEventListener(parent, 'resize', onContainerScroll, false);
  
      return () => {
        onScrollListener.remove();
        onResizeListener.remove();
      };
    }
    return () => {};
  }, [firstSrcollParent]);

  React.useEffect(() => {
    setFirstScrollParent(getScrollParent(scrollBodyRef.current));
    setTimeout(() => {
      setFirstScrollParent(getScrollParent(scrollBodyRef.current));
    }, 2000)
  }, [scrollBodyRef.current]);



  React.useEffect(() => {
    if (!frameState.isHiddenScrollBar) {
      setFrameState(state => ({
        ...state,
        scrollLeft:
          (scrollBodyRef.current.scrollLeft / scrollBodyRef.current?.scrollWidth) *
          scrollBodyRef.current?.clientWidth,
      }));
    }
  }, [frameState.isHiddenScrollBar]);

  if (bodyScrollWidth <= bodyWidth || !scrollBarWidth || frameState.isHiddenScrollBar) {
    return null;
  }

  return (
    <div
      style={{
        height: scrollbarSize,
        width: bodyWidth,
        bottom: offsetScroll,
        transform: `translateY(${frameState.translateY}px)`
      }}
      className={`${prefixCls}-sticky-scroll`}
    >
      <div
        onMouseDown={onMouseDown}
        ref={scrollBarRef}
        className={classNames(`${prefixCls}-sticky-scroll-bar`, {
          [`${prefixCls}-sticky-scroll-bar-active`]: isActive,
        })}
        style={{
          width: `${scrollBarWidth}px`,
          transform: `translate3d(${frameState.scrollLeft}px, 0, 0)`,
        }}
      />
    </div>
  );
};

export default React.forwardRef(StickyScrollBar);
