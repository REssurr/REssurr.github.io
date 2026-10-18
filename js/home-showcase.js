(function () {
  'use strict';

  /* ========== 副标题打字机（本地实现，不依赖 CDN） ========== */
  function initTypewriter() {
    var el = document.getElementById('subtitle');
    if (!el) return;

    var text = (el.textContent || '').trim();
    if (!text) return;

    var i = 0;
    var typing = true;

    function frame(delay) {
      window.setTimeout(step, delay);
    }

    function step() {
      if (typing) {
        i += 1;
        el.textContent = text.slice(0, i);
        if (i >= text.length) {
          typing = false;
          frame(1600);              // 打完停一下
          return;
        }
        frame(110);                 // 打字速度
        return;
      }
      i -= 1;
      el.textContent = text.slice(0, Math.max(0, i));
      if (i <= 0) {
        typing = true;
        frame(500);                 // 删完停一下，重新开始
        return;
      }
      frame(45);                    // 删字速度
    }

    el.textContent = '';
    frame(400);
  }

  initTypewriter();

  /* ========== 三态整页：封面 → 展示页 → 文章页 ========== */
  var root = document.documentElement;
  if (!root.classList.contains('hs-js')) return;   // 手机端 / 启动失败

  var showcase = document.getElementById('hs-showcase');
  var panel = document.getElementById('hs-posts');
  if (!showcase || !panel) return;

  var postVideo = document.getElementById('hs-post-video');

  /* 所有卡片等高：顶边钉在 42%（或 50%）线上，高度统一取最高的那张；
     顶边上提了多少，就额外补多少高度，底边位置保持不变 */
  function equalizeCards() {
    var cards = showcase.querySelectorAll('.hs-card');
    if (!cards.length) return;

    var i;
    for (i = 0; i < cards.length; i++) cards[i].style.height = '';

    var max = 0;
    for (i = 0; i < cards.length; i++) {
      max = Math.max(max, cards[i].offsetHeight);
    }
    if (!max) return;

    var yPct = 50;
    var style = cards[0].getAttribute('style') || '';
    var m = style.match(/--hs-y:\s*([\d.]+)%/);
    if (m) yPct = parseFloat(m[1]);
    var extra = Math.max(0, (50 - yPct) / 100 * window.innerHeight);

    var target = max + extra;
    for (i = 0; i < cards.length; i++) cards[i].style.height = target + 'px';
  }

  window.addEventListener('load', equalizeCards);
  window.addEventListener('resize', equalizeCards);
  // 封面图加载完会改变高度，补一次
  Array.prototype.forEach.call(showcase.querySelectorAll('img'), function (img) {
    if (!img.complete) img.addEventListener('load', equalizeCards);
  });

  function playPostBg() {
    if (!postVideo) return;
    var p = postVideo.play();
    // 自动播放被策略拦下时不报错，等第一次用户交互再重试
    if (p && typeof p.catch === 'function') p.catch(function () {});
  }

  function pausePostBg(reset) {
    if (!postVideo) return;
    postVideo.pause();
    if (reset) {
      try { postVideo.currentTime = 0; } catch (e) {}
    }
  }

  function retryPostBg() {
    if (state === 'posts' && postVideo && postVideo.paused) playPostBg();
  }

  window.__hsBooted = true;

  var DUR = 700;             // 与 CSS 的 .7s 保持一致
  var state = 'cover';       // cover | show | posts
  var busy = false;
  var arrivedAt = 0;         // 用来区分“惯性滚动”和“新的一次上滚”

  function stamp() {
    arrivedAt = performance.now();
  }

  function after(fn) {
    window.setTimeout(function () {
      busy = false;
      fn();
    }, DUR);
  }

  /* 封面 → 展示页 */
  function toShow() {
    if (busy || state !== 'cover') return;
    busy = true;
    root.classList.add('hs-show');
    after(function () {
      state = 'show';
      equalizeCards();          // 卡片显现后按内容统一高度
      stamp();
    });
  }

  /* 展示页 → 文章页：面板升起与视频淡入同时开始 */
  function toPosts() {
    if (busy || state !== 'show') return;
    busy = true;
    panel.scrollTop = 0;
    if (postVideo) {
      try { postVideo.currentTime = 0; } catch (e) {}   // 每次从片头开始
    }
    playPostBg();
    root.classList.add('hs-posts');
    after(function () {
      state = 'posts';
      stamp();
    });
  }

  /* 文章页 → 展示页：下滑与淡出并行，动画结束才停播 */
  function toShowFromPosts() {
    if (busy || state !== 'posts') return;
    busy = true;
    root.classList.remove('hs-posts');
    after(function () {
      state = 'show';
      pausePostBg(true);
      panel.scrollTop = 0;
      stamp();
    });
  }

  /* 展示页 → 封面 */
  function toCover() {
    if (busy || state !== 'show') return;
    busy = true;
    root.classList.remove('hs-show');
    after(function () {
      state = 'cover';
    });
  }

  /* 文章页 → 封面（先回展示页，再回封面，两段动画） */
  function toCoverFromPosts() {
    if (busy || state !== 'posts') return;
    toShowFromPosts();
    window.setTimeout(function () {
      if (!busy && state === 'show') toCover();
    }, DUR + 30);
  }

  /* ---------- 滚轮 ---------- */
  window.addEventListener('wheel', function (e) {
    if (busy) {
      e.preventDefault();
      return;
    }

    if (state === 'cover') {
      if (e.deltaY > 0) {
        e.preventDefault();
        toShow();
      }
      return;
    }

    if (state === 'show') {
      if (e.deltaY > 0) {
        e.preventDefault();
        toPosts();
      } else if (e.deltaY < 0 && performance.now() - arrivedAt > 200) {
        e.preventDefault();
        toCover();
      }
      return;
    }

    // posts：面板滚到顶之后再上滚，才反向回展示页
    if (e.deltaY < 0 && panel.scrollTop <= 0 && performance.now() - arrivedAt > 200) {
      e.preventDefault();
      toShowFromPosts();
    }
  }, { passive: false });

  /* 文章面板滚到顶部时记录时间 */
  panel.addEventListener('scroll', function () {
    if (state === 'posts' && panel.scrollTop <= 0) stamp();
  }, { passive: true });

  /* ---------- 点击 ---------- */

  // 封面：点空白处翻到展示页（链接、按钮除外）
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t && t.closest && t.closest('a, button')) return;
    if (busy || state !== 'cover') return;
    toShow();
  });

  // 下箭头：等同于滚一下
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest || !t.closest('#scroll-down')) return;
    e.preventDefault();
    e.stopPropagation();
    toShow();
  }, true);

  // 展示页的“下滑查看博客文章”：切到文章页
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest || !t.closest('.hs-hint')) return;
    e.preventDefault();
    e.stopPropagation();
    if (!busy && state === 'show') toPosts();
  }, true);

  // 导航栏站名：回封面
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest || !t.closest('#blog-info')) return;
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    if (state === 'posts') toCoverFromPosts();
    else if (state === 'show') toCover();
  }, true);

  // 右上角“回到顶部”：改成滚文章面板
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest || !t.closest('#go-up')) return;
    e.preventDefault();
    e.stopPropagation();
    panel.scrollTo({ top: 0, behavior: 'smooth' });
    stamp();
  }, true);

  // 切到后台停掉背景视频，回来再继续
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      pausePostBg(false);
    } else if (state === 'posts') {
      playPostBg();
    }
  });

  // 自动播放被浏览器策略拦下的兜底：第一次点击 / 按键 / 触摸时再试
  ['click', 'keydown', 'touchstart'].forEach(function (ev) {
    document.addEventListener(ev, retryPostBg, { passive: true });
  });

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);
})();
