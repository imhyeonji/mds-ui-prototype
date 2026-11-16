import { type RefObject, useEffect, useState } from "react";

// Whether the page has been scrolled past an element: it is entirely above the visible area. `topOffset` is the
// height of a fixed bar at the top that hides what is behind it. Checked on every scroll (once per frame), on
// resizes and when the page content changes height, so a fast jump past the element is not missed.
export function useScrolledPast(ref: RefObject<Element | null>, topOffset = 0): boolean {
  const [scrolledPast, setScrolledPast] = useState(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      if (ref.current) setScrolledPast(ref.current.getBoundingClientRect().bottom <= topOffset);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    // Capture: also scrolls of inner containers, which do not bubble
    window.addEventListener("scroll", schedule, { capture: true, passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    const contentResize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    contentResize?.observe(document.body);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
      contentResize?.disconnect();
    };
  }, [ref, topOffset]);

  return scrolledPast;
}
