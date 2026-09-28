# 35. Performance

A polished interface that drops frames is not polished.

## 35.1 Rendering

Avoid unnecessary React rerenders during:

- drag;
- timer updates;
- scrolling;
- animation frames.

Keep rapidly changing timer state localized.

Do not rerender an entire library page every second because a reading session timer is running elsewhere.

---

## 35.2 Images

Book covers can dominate network and memory cost.

Use:

- correct dimensions;
- responsive sources where available;
- lazy loading;
- placeholders;
- stable aspect ratio;
- caching;
- graceful broken-image fallback.

Avoid layout shift when covers load.

---

## 35.3 Long lists

For large libraries/search results:

- paginate or incrementally load;
- consider virtualization only when it materially helps and does not break Ionic/page behavior;
- preserve scroll position;
- avoid rendering expensive hidden card content.

---

## 35.4 Animation performance

- prefer compositor-friendly transforms/opacity;
- pause looping animation offscreen;
- toggle `will-change` only during heavy animation;
- do not leave permanent compositor promotion everywhere;
- avoid CSS-variable-driven drag transforms that trigger expensive recalculation through large subtrees.

---

