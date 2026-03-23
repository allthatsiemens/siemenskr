document.addEventListener('DOMContentLoaded', () => {
  const body = document.body;
  const tabs = document.querySelectorAll('.tab');
  const heroSearchInput = document.querySelector('.hero-search input');
  const heroSearchBtn = document.querySelector('.hero-search button');
  const authModal = document.getElementById('authModal');
  const authClose = document.getElementById('authClose');
  const loginTrigger = document.getElementById('loginTrigger');
  const logoutBtn = document.getElementById('logoutBtn');
  const userMenu = document.getElementById('userMenu');
  const userAvatar = document.getElementById('userAvatar');
  const userName = document.getElementById('userName');
  const userEmail = document.getElementById('userEmail');
  const authStatus = document.getElementById('authStatus');
  const googleButtonSlot = document.getElementById('googleSignInButton');
  const askCommunityBtn = document.getElementById('askCommunityBtn');
  const askAccessHint = document.getElementById('askAccessHint');
  const menuToggle = document.getElementById('menuToggle');
  const primaryMenu = document.getElementById('primaryMenu');
  const navLinks = document.querySelectorAll('.menu a[href^="#"]');
  const categoryCards = document.querySelectorAll('.cat-item-clickable[data-href]');
  const questionModal = document.getElementById('questionModal');
  const questionClose = document.getElementById('questionClose');
  const questionCancel = document.getElementById('questionCancel');
  const questionForm = document.getElementById('questionForm');
  const questionStatus = document.getElementById('questionStatus');
  const questionList = document.getElementById('questionList');
  const questionEmptyState = document.getElementById('questionEmptyState');
  const forumQuestionList = document.getElementById('forumQuestionList');
  const forumQuestionEmptyState = document.getElementById('forumQuestionEmptyState');
  const forumSortSelect = document.querySelector('.forum-content .sort-wrap select');
  const questionCategoryField = document.getElementById('questionCategory');

  const GOOGLE_CLIENT_ID = body.dataset.googleClientId;
  const CURRENT_FORUM_CATEGORY = body.dataset.forumCategory || '';
  const AUTH_API_ENDPOINT = '/api/auth/google';
  const USER_STORAGE_KEY = 'siemenskr_google_user';
  const QUESTION_STORAGE_KEY = 'siemenskr_member_questions';
  const CATEGORY_BY_SECTION_ID = {
    climatix: 'Climatix',
    hvac: 'HVAC Instrument',
    datasheet: 'Data Sheet(기술자료)',
    others: '기타'
  };

  let currentUser = null;
  let pendingProtectedAction = null;

  const setAuthStatus = (message = '', type = 'default') => {
    if (!authStatus) return;
    authStatus.textContent = message;
    authStatus.dataset.state = type;
  };

  const setQuestionStatus = (message = '', type = 'default') => {
    if (!questionStatus) return;
    questionStatus.textContent = message;
    questionStatus.dataset.state = type;
  };

  const saveUser = (user) => {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  };

  const loadUser = () => {
    try {
      const raw = localStorage.getItem(USER_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.error('Failed to parse user state', error);
      return null;
    }
  };

  const clearUser = () => {
    localStorage.removeItem(USER_STORAGE_KEY);
  };

  const loadQuestions = () => {
    try {
      const raw = localStorage.getItem(QUESTION_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((item) => item && item.category && item.title && item.content) : [];
    } catch (error) {
      console.error('Failed to parse question state', error);
      return [];
    }
  };

  const saveQuestions = (questions) => {
    localStorage.setItem(QUESTION_STORAGE_KEY, JSON.stringify(questions));
  };

  const escapeHtml = (value = '') => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const formatDateTime = (value) => {
    try {
      return new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date(value));
    } catch (error) {
      return value;
    }
  };

  const formatRelativeTime = (value) => {
    if (!value) return '아직 없음';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '아직 없음';

    const diffMs = Date.now() - date.getTime();
    const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

    if (diffMinutes < 1) return '방금 전';
    if (diffMinutes < 60) return `${diffMinutes}분 전`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}시간 전`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return '어제';
    if (diffDays < 7) return `${diffDays}일 전`;

    return formatDateTime(value);
  };

  const getSortedQuestions = (questions, sortType = 'latest') => {
    const cloned = [...questions];

    if (sortType === 'oldest') {
      return cloned.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }

    if (sortType === 'a-z') {
      return cloned.sort((a, b) => String(a.title).localeCompare(String(b.title), 'ko'));
    }

    if (sortType === 'most-replies') {
      return cloned.sort((a, b) => Number(b.replyCount || 0) - Number(a.replyCount || 0));
    }

    return cloned.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  };

  const getCategoryQuestions = (category) => loadQuestions().filter((question) => question.category === category);

  const getCategoryStats = (category) => {
    const questions = getCategoryQuestions(category);
    const latestQuestion = getSortedQuestions(questions, 'latest')[0] || null;

    return {
      topics: questions.length,
      replies: questions.reduce((total, question) => total + Number(question.replyCount || 0), 0),
      latestQuestion
    };
  };

  const buildCommunityQuestionCard = (question) => `
    <article class="question-card">
      <div class="question-card-meta">
        <span class="question-category">${escapeHtml(question.category)}</span>
        <span class="question-date">${escapeHtml(formatDateTime(question.createdAt))}</span>
      </div>
      <h3>${escapeHtml(question.title)}</h3>
      <p>${escapeHtml(question.content)}</p>
      <div class="question-author-row">
        <img src="${escapeHtml(question.authorPicture || 'https://www.gstatic.com/images/branding/product/1x/avatar_circle_blue_512dp.png')}" alt="${escapeHtml(question.authorName || '사용자')} 프로필" referrerpolicy="no-referrer">
        <div>
          <strong>${escapeHtml(question.authorName || 'Siemens User')}</strong>
          <span>${escapeHtml(question.authorEmail || '')}</span>
        </div>
      </div>
    </article>
  `;

  const buildForumTopicCard = (question, index) => `
    <article class="topic-card ${index === 0 ? 'featured-topic-card' : ''}">
      <div class="topic-card-top">
        <span class="topic-status is-open">Open</span>
        <span class="topic-updated">Updated ${escapeHtml(formatRelativeTime(question.createdAt))}</span>
      </div>
      <h3>${escapeHtml(question.title)}</h3>
      <p>${escapeHtml(question.content)}</p>
      <div class="topic-meta-row">
        <span>작성자: ${escapeHtml(question.authorName || 'Siemens User')}</span>
        <span>이메일: ${escapeHtml(question.authorEmail || '-')}</span>
        <span>Replies: ${Number(question.replyCount || 0)}</span>
      </div>
    </article>
  `;

  const renderCommunityQuestions = () => {
    if (!questionList || !questionEmptyState) return;
    const questions = getSortedQuestions(loadQuestions(), 'latest');
    questionList.innerHTML = '';

    if (!questions.length) {
      questionEmptyState.classList.remove('is-hidden');
      return;
    }

    questionEmptyState.classList.add('is-hidden');
    questionList.innerHTML = questions.map(buildCommunityQuestionCard).join('');
  };

  const updateHomepageCategoryStats = () => {
    document.querySelectorAll('.cat-item').forEach((card) => {
      const category = CATEGORY_BY_SECTION_ID[card.id];
      if (!category) return;

      const stats = getCategoryStats(category);
      const values = card.querySelectorAll('.cat-stats .data-val');
      const labels = card.querySelectorAll('.cat-stats .stat-label');

      if (values[0]) values[0].textContent = stats.replies.toLocaleString('en-US');
      if (labels[0]) labels[0].textContent = 'REPLIES';
      if (values[1]) values[1].textContent = stats.topics.toLocaleString('en-US');
      if (labels[1]) labels[1].textContent = 'TOPICS';
      if (values[2]) values[2].textContent = formatRelativeTime(stats.latestQuestion?.createdAt);
      if (labels[2]) labels[2].textContent = 'LAST UPDATE';
    });
  };

  const renderForumCategoryPage = () => {
    if (!CURRENT_FORUM_CATEGORY || !forumQuestionList || !forumQuestionEmptyState) return;

    const selectedSort = forumSortSelect?.value || 'Latest activity';
    const sortType = selectedSort === 'A-Z'
      ? 'a-z'
      : selectedSort === 'Most replies'
        ? 'most-replies'
        : selectedSort === 'Oldest activity'
          ? 'oldest'
          : 'latest';

    const questions = getSortedQuestions(getCategoryQuestions(CURRENT_FORUM_CATEGORY), sortType);
    forumQuestionList.innerHTML = '';

    if (!questions.length) {
      forumQuestionEmptyState.classList.remove('is-hidden');
    } else {
      forumQuestionEmptyState.classList.add('is-hidden');
      forumQuestionList.innerHTML = questions.map(buildForumTopicCard).join('');
    }

    const titleNode = document.getElementById('currentTopicsTitle');
    if (titleNode) {
      titleNode.textContent = `${CURRENT_FORUM_CATEGORY} Questions`;
    }
  };

  const updateForumHeroStats = () => {
    if (!CURRENT_FORUM_CATEGORY) return;

    const stats = getCategoryStats(CURRENT_FORUM_CATEGORY);
    const cards = document.querySelectorAll('.forum-hero-stats .forum-stat-card');

    if (cards[0]) {
      const strong = cards[0].querySelector('strong');
      const label = cards[0].querySelector('span');
      if (strong) strong.textContent = stats.topics.toLocaleString('en-US');
      if (label) label.textContent = 'Total Topics';
    }

    if (cards[1]) {
      const strong = cards[1].querySelector('strong');
      const label = cards[1].querySelector('span');
      if (strong) strong.textContent = stats.replies.toLocaleString('en-US');
      if (label) label.textContent = 'Total Replies';
    }

    if (cards[2]) {
      const strong = cards[2].querySelector('strong');
      const label = cards[2].querySelector('span');
      if (strong) strong.textContent = formatRelativeTime(stats.latestQuestion?.createdAt);
      if (label) label.textContent = 'Last Update';
    }

    const overviewRecentActivity = document.querySelector('.forum-side-list li:last-child strong');
    if (overviewRecentActivity) {
      overviewRecentActivity.textContent = formatRelativeTime(stats.latestQuestion?.createdAt);
    }
  };

  const refreshQuestionDrivenUI = () => {
    renderCommunityQuestions();
    updateHomepageCategoryStats();
    updateForumHeroStats();
    renderForumCategoryPage();
  };

  const openAuthModal = (message = 'Google 계정으로 로그인해 주세요.', state = 'default') => {
    authModal?.classList.remove('is-hidden');
    document.body.classList.add('modal-open');
    setAuthStatus(message, state);
  };

  const closeAuthModal = () => {
    authModal?.classList.add('is-hidden');
    if (!questionModal || questionModal.classList.contains('is-hidden')) {
      document.body.classList.remove('modal-open');
    }
  };

  const openQuestionModal = () => {
    questionModal?.classList.remove('is-hidden');
    document.body.classList.add('modal-open');
    setQuestionStatus('', 'default');
    if (questionForm) {
      questionForm.reset();
    }
    if (questionCategoryField && CURRENT_FORUM_CATEGORY) {
      questionCategoryField.value = CURRENT_FORUM_CATEGORY;
    }
  };

  const closeQuestionModal = () => {
    questionModal?.classList.add('is-hidden');
    if (!authModal || authModal.classList.contains('is-hidden')) {
      document.body.classList.remove('modal-open');
    }
  };

  const updateAskAccess = () => {
    const isLoggedIn = Boolean(currentUser && currentUser.email);
    if (!askCommunityBtn || !askAccessHint) return;

    if (isLoggedIn) {
      askCommunityBtn.classList.remove('member-locked');
      askCommunityBtn.textContent = 'Ask the Community';
      askAccessHint.textContent = `${currentUser.name || '회원'}님, 질문을 작성할 수 있습니다.`;
    } else {
      askCommunityBtn.classList.add('member-locked');
      askCommunityBtn.textContent = 'Ask the Community · 회원 전용';
      askAccessHint.textContent = '회원 전용 기능입니다. 로그인 후 질문을 작성할 수 있습니다.';
    }
  };

  const renderUser = (user) => {
    currentUser = user && user.email ? user : null;

    if (currentUser) {
      loginTrigger?.classList.add('is-hidden');
      userMenu?.classList.remove('is-hidden');
      if (userName) userName.textContent = currentUser.name || 'Siemens User';
      if (userEmail) userEmail.textContent = currentUser.email || '';
      if (userAvatar) {
        userAvatar.src = currentUser.picture || 'https://www.gstatic.com/images/branding/product/1x/avatar_circle_blue_512dp.png';
        userAvatar.alt = `${currentUser.name || currentUser.email} 프로필 이미지`;
      }
    } else {
      loginTrigger?.classList.remove('is-hidden');
      userMenu?.classList.add('is-hidden');
      userAvatar?.removeAttribute('src');
      if (userName) userName.textContent = 'Guest';
      if (userEmail) userEmail.textContent = '';
    }

    updateAskAccess();
  };

  const handleLogout = () => {
    clearUser();
    renderUser(null);
    closeQuestionModal();
    setAuthStatus('로그아웃되었습니다.', 'default');
    setQuestionStatus('', 'default');
    pendingProtectedAction = null;
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect();
    }
  };

  const sendGoogleCredential = async (credential) => {
    const response = await fetch(AUTH_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ idToken: credential })
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || '로그인 처리 중 오류가 발생했습니다.');
    }

    return data;
  };

  const handleCredentialResponse = async ({ credential }) => {
    if (!credential) {
      setAuthStatus('Google 인증 정보를 받지 못했습니다.', 'error');
      return;
    }

    setAuthStatus('회원 정보를 확인하고 있습니다...', 'loading');

    try {
      const result = await sendGoogleCredential(credential);
      saveUser(result.user);
      renderUser(result.user);

      if (result.mode === 'signup') {
        setAuthStatus('회원가입이 완료되었습니다. 환영합니다!', 'success');
      } else {
        setAuthStatus('로그인되었습니다. 다시 오신 것을 환영합니다!', 'success');
      }

      window.setTimeout(() => {
        closeAuthModal();
        if (pendingProtectedAction === 'ask') {
          pendingProtectedAction = null;
          openQuestionModal();
        }
      }, 700);
    } catch (error) {
      console.error(error);
      setAuthStatus(error.message || '로그인 처리 중 오류가 발생했습니다.', 'error');
    }
  };

  const initGoogleSignIn = (retryCount = 0) => {
    if (window.google?.accounts?.id && googleButtonSlot) {
      googleButtonSlot.innerHTML = '';
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
        ux_mode: 'popup'
      });
      window.google.accounts.id.renderButton(googleButtonSlot, {
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        text: 'signin_with',
        locale: 'ko'
      });
      return;
    }

    if (retryCount < 30) {
      window.setTimeout(() => initGoogleSignIn(retryCount + 1), 300);
    } else {
      setAuthStatus('Google 로그인 버튼을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.', 'error');
    }
  };

  const syncMenuState = (isOpen) => {
    if (!menuToggle || !primaryMenu) return;
    menuToggle.classList.toggle('is-open', isOpen);
    primaryMenu.classList.toggle('is-open', isOpen);
    menuToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    menuToggle.setAttribute('aria-label', isOpen ? '메뉴 닫기' : '메뉴 열기');
  };

  const closeMobileMenu = () => syncMenuState(false);

  const toggleMobileMenu = () => {
    if (!menuToggle || !primaryMenu) return;
    const isOpen = !primaryMenu.classList.contains('is-open');
    syncMenuState(isOpen);
  };

  const handleAskClick = () => {
    if (!currentUser) {
      pendingProtectedAction = 'ask';
      openAuthModal('질문 작성은 회원 전용입니다. 먼저 Google 로그인해 주세요.', 'default');
      return;
    }

    openQuestionModal();
  };

  const handleQuestionSubmit = (event) => {
    event.preventDefault();

    if (!currentUser) {
      closeQuestionModal();
      pendingProtectedAction = 'ask';
      openAuthModal('로그인 상태가 필요합니다. 다시 로그인해 주세요.', 'error');
      return;
    }

    const category = questionCategoryField?.value?.trim();
    const title = document.getElementById('questionTitle')?.value?.trim();
    const content = document.getElementById('questionContent')?.value?.trim();

    if (!category || !title || !content) {
      setQuestionStatus('카테고리, 제목, 내용을 모두 입력해 주세요.', 'error');
      return;
    }

    const questions = loadQuestions();
    questions.unshift({
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      category,
      title,
      content,
      createdAt: new Date().toISOString(),
      authorName: currentUser.name || 'Siemens User',
      authorEmail: currentUser.email || '',
      authorPicture: currentUser.picture || '',
      replyCount: 0
    });

    saveQuestions(questions);
    refreshQuestionDrivenUI();
    setQuestionStatus('질문이 등록되었습니다.', 'success');

    window.setTimeout(() => {
      closeQuestionModal();
      const targetList = forumQuestionList || questionList;
      targetList?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 500);
  };

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((item) => {
        item.classList.remove('active');
        item.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
    });
  });

  categoryCards.forEach((card) => {
    const targetHref = card.dataset.href;
    if (!targetHref) return;

    card.addEventListener('click', (event) => {
      if (event.target.closest('a, button, input, select, textarea, label')) {
        return;
      }
      window.location.href = targetHref;
    });

    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        window.location.href = targetHref;
      }
    });
  });

  if (heroSearchBtn && heroSearchInput) {
    heroSearchBtn.addEventListener('click', () => {
      const query = heroSearchInput.value.trim();
      if (query) {
        alert(`Searching for: ${query}\n(This is a demonstration of the search interface.)`);
      }
    });
  }

  const getStickyOffset = () => {
    const header = document.querySelector('.topnav');
    const toolbar = document.querySelector('.toolbar');
    const headerHeight = header ? header.offsetHeight : 0;
    const toolbarHeight = toolbar ? toolbar.offsetHeight : 0;
    return headerHeight + toolbarHeight + 16;
  };

  const setActiveNavLink = (targetSelector) => {
    navLinks.forEach((link) => {
      const isActive = link.getAttribute('href') === targetSelector;
      link.classList.toggle('active', isActive);
      link.setAttribute('aria-current', isActive ? 'true' : 'false');
    });
  };

  navLinks.forEach((anchor) => {
    anchor.addEventListener('click', function (event) {
      const targetSelector = this.getAttribute('href');
      const target = document.querySelector(targetSelector);
      if (!target) return;

      event.preventDefault();
      closeMobileMenu();
      setActiveNavLink(targetSelector);
      const top = target.getBoundingClientRect().top + window.pageYOffset - getStickyOffset();
      window.scrollTo({ top, behavior: 'smooth' });
      if (history.pushState) {
        history.pushState(null, '', targetSelector);
      } else {
        location.hash = targetSelector;
      }
    });
  });

  const sectionObserverTargets = Array.from(navLinks)
    .map((link) => {
      const selector = link.getAttribute('href');
      const element = selector ? document.querySelector(selector) : null;
      return element ? { selector, element } : null;
    })
    .filter(Boolean);

  if (sectionObserverTargets.length && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      const visibleEntry = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

      if (visibleEntry?.target?.id) {
        setActiveNavLink(`#${visibleEntry.target.id}`);
      }
    }, {
      rootMargin: '-120px 0px -55% 0px',
      threshold: [0.2, 0.35, 0.5]
    });

    sectionObserverTargets.forEach(({ element }) => observer.observe(element));
  }

  if (window.location.hash) {
    setActiveNavLink(window.location.hash);
  } else if (navLinks[0]) {
    setActiveNavLink(navLinks[0].getAttribute('href'));
  }

  menuToggle?.addEventListener('click', toggleMobileMenu);

  window.addEventListener('resize', () => {
    if (window.innerWidth > 900) {
      closeMobileMenu();
    }
  });

  forumSortSelect?.addEventListener('change', renderForumCategoryPage);

  loginTrigger?.addEventListener('click', () => openAuthModal());
  logoutBtn?.addEventListener('click', handleLogout);
  authClose?.addEventListener('click', closeAuthModal);
  questionClose?.addEventListener('click', closeQuestionModal);
  questionCancel?.addEventListener('click', closeQuestionModal);
  askCommunityBtn?.addEventListener('click', handleAskClick);
  questionForm?.addEventListener('submit', handleQuestionSubmit);

  authModal?.addEventListener('click', (event) => {
    if (event.target instanceof HTMLElement && event.target.dataset.closeAuth === 'true') {
      closeAuthModal();
    }
  });

  questionModal?.addEventListener('click', (event) => {
    if (event.target instanceof HTMLElement && event.target.dataset.closeQuestion === 'true') {
      closeQuestionModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeMobileMenu();
      if (questionModal && !questionModal.classList.contains('is-hidden')) {
        closeQuestionModal();
      }
      if (authModal && !authModal.classList.contains('is-hidden')) {
        closeAuthModal();
      }
    }
  });

  renderUser(loadUser());
  refreshQuestionDrivenUI();
  initGoogleSignIn();
});
