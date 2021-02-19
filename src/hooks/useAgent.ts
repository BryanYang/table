import { useMemo } from 'react';

const useChromeVersion = () => {
  return useMemo(() => {
    const matchs = window.navigator.userAgent.match(/Chrome\/(\d+)/);
    if (matchs && matchs.length && matchs.length > 0) {
      return Number(matchs[1]);
    }
    return null;
  }, [])
}

export {
  useChromeVersion,
}