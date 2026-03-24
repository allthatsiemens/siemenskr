document.addEventListener('DOMContentLoaded', () => {
  const body = document.body;
  const tabs = document.querySelectorAll('.tab');
  const heroSearchInput = document.querySelector('.hero-search input');
  const heroSearchBtn = document.querySelector('.hero-search button');
  const miniSearchInput = document.querySelector('.search-mini input');
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
  const questionModalTitle = document.getElementById('questionModalTitle');
  const questionModalDesc = questionModal?.querySelector('.auth-desc');
  const questionSubmitButton = questionForm?.querySelector('button[type="submit"]');
  const questionTitleField = document.getElementById('questionTitle');
  const questionResourceLinkField = document.getElementById('questionResourceLink');
  const questionResourceLinkGroup = document.getElementById('questionResourceLinkGroup');
  const questionContentField = document.getElementById('questionContent');
  const questionList = document.getElementById('questionList');
  const questionEmptyState = document.getElementById('questionEmptyState');
  const memberPostsDesc = document.querySelector('.member-posts-desc');
  const forumQuestionList = document.getElementById('forumQuestionList');
  const forumQuestionEmptyState = document.getElementById('forumQuestionEmptyState');
  const forumSortSelect = document.querySelector('.forum-content .sort-wrap select');
  const questionCategoryField = document.getElementById('questionCategory');
  const communityForumCount = document.getElementById('communityForumCount');

  const GOOGLE_CLIENT_ID = body.dataset.googleClientId;
  const CURRENT_FORUM_CATEGORY = body.dataset.forumCategory || '';
  const AUTH_API_ENDPOINT = '/api/auth/google';
  const QUESTION_API_ENDPOINT = '/api/questions';
  const APPS_SCRIPT_URL = body.dataset.appsScriptUrl || '';
  const USER_STORAGE_KEY = 'siemenskr_google_user';
  const AUTH_TOKEN_STORAGE_KEY = 'siemenskr_google_id_token';
  const QUESTION_STORAGE_KEY = 'siemenskr_member_questions';
  const MIGRATION_STORAGE_KEY = 'siemenskr_questions_migrated_v1';
  const DATASHEET_CATEGORY = 'Data Sheet(기술자료)';
  const RESOURCE_LINK_MARKER = '[[RESOURCE_LINK::';
  const MAX_REPLY_ATTACHMENTS = 3;
  const MAX_ATTACHMENT_SIZE_MB = 5;
  const PDF_ATTACHMENT_TYPES = new Set(['application/pdf']);

  const inferAttachmentTypeFromName = (fileName = '') => /\.pdf$/i.test(String(fileName || '').trim()) ? 'application/pdf' : '';

  const isImageAttachmentType = (contentType = '') => String(contentType || '').toLowerCase().startsWith('image/');
  const isPdfAttachmentType = (contentType = '') => PDF_ATTACHMENT_TYPES.has(String(contentType || '').toLowerCase());
  const isAllowedReplyAttachmentType = (contentType = '', fileName = '') => {
    const normalizedType = String(contentType || '').toLowerCase();
    return isImageAttachmentType(normalizedType) || isPdfAttachmentType(normalizedType) || inferAttachmentTypeFromName(fileName) === 'application/pdf';
  };
  const CATEGORY_BY_SECTION_ID = {
    climatix: 'Climatix',
    hvac: 'HVAC Instrument',
    datasheet: DATASHEET_CATEGORY,
    others: '기타'
  };

  let currentUser = null;
  let pendingProtectedAction = null;
  let googleIdToken = window.sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || '';
  let questionStore = [];
  let usingRemoteQuestionStore = false;
  let activeSearchQuery = '';
  let editingQuestionId = '';
  const defaultQuestionEmptyMessage = questionEmptyState?.textContent || '아직 등록된 질문이 없습니다. 로그인 후 첫 질문을 작성해보세요.';
  const defaultForumEmptyMessage = forumQuestionEmptyState?.textContent || '아직 등록된 실제 질문이 없습니다. 로그인 후 첫 문의를 등록해보세요.';
  const defaultMemberPostsDesc = memberPostsDesc?.textContent || '';
  const defaultQuestionModalTitle = questionModalTitle?.textContent || 'Ask the Community';
  const defaultQuestionModalDesc = questionModalDesc?.textContent || '로그인한 회원만 질문을 작성할 수 있습니다. 카테고리, 제목, 내용을 입력한 뒤 등록해 주세요.';
  const defaultQuestionSubmitLabel = questionSubmitButton?.textContent || '질문 등록';

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
    window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  };

  const loadUser = () => {
    try {
      const raw = window.localStorage.getItem(USER_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.error('Failed to parse user state', error);
      return null;
    }
  };

  const clearUser = () => {
    window.localStorage.removeItem(USER_STORAGE_KEY);
  };

  const isDataSheetCategory = (category = '') => String(category || '').trim() === DATASHEET_CATEGORY;

  const normalizeResourceLink = (value = '') => {
    const trimmed = String(value || '').trim();
    if (!trimmed) return '';

    try {
      const parsed = new URL(trimmed);
      if (!/^https?:$/i.test(parsed.protocol)) {
        return '';
      }
      return parsed.toString();
    } catch (error) {
      return '';
    }
  };

  const parseQuestionContentPayload = (category = '', rawContent = '') => {
    const text = String(rawContent || '');
    if (!isDataSheetCategory(category)) {
      return { content: text.trim(), resourceLink: '' };
    }

    const markerPattern = /\s*\[\[RESOURCE_LINK::(https?:\/\/[^\s\]]+)\]\]\s*$/i;
    const markerMatch = text.match(markerPattern);
    if (markerMatch) {
      return {
        content: text.replace(markerPattern, '').trim(),
        resourceLink: normalizeResourceLink(markerMatch[1])
      };
    }

    const trimmed = text.trim();
    if (/^https?:\/\/\S+$/i.test(trimmed)) {
      return { content: '', resourceLink: normalizeResourceLink(trimmed) };
    }

    return { content: trimmed, resourceLink: '' };
  };

  const buildQuestionContentPayload = (category = '', content = '', resourceLink = '') => {
    const normalizedContent = String(content || '').trim();
    const normalizedLink = normalizeResourceLink(resourceLink);

    if (!isDataSheetCategory(category) || !normalizedLink) {
      return normalizedContent;
    }

    return `${normalizedContent}\n\n${RESOURCE_LINK_MARKER}${normalizedLink}]]`;
  };

  const formatRichText = (value = '') => escapeHtml(value).replace(/\n/g, '<br>');

  const buildQuestionResourceLink = (question) => {
    const normalizedLink = normalizeResourceLink(question?.resourceLink || '');
    if (!normalizedLink) return '';

    return `
      <div class="question-resource-link-wrap">
        <a class="question-resource-link" href="${escapeHtml(normalizedLink)}" target="_blank" rel="noopener noreferrer">자료 링크 열기</a>
      </div>
    `;
  };

  const updateQuestionResourceLinkVisibility = () => {
    const selectedCategory = questionCategoryField?.value || CURRENT_FORUM_CATEGORY || '';
    const shouldShow = isDataSheetCategory(selectedCategory);

    if (questionResourceLinkGroup) {
      questionResourceLinkGroup.hidden = !shouldShow;
    }

    if (questionResourceLinkField) {
      if (shouldShow) {
        questionResourceLinkField.placeholder = 'https://example.com/datasheet.pdf';
      } else {
        questionResourceLinkField.value = '';
      }
    }

    if (questionModalDesc && !editingQuestionId) {
      questionModalDesc.textContent = shouldShow
        ? '기술자료 카테고리에서는 제목, 설명과 함께 자료 링크를 함께 등록할 수 있습니다.'
        : defaultQuestionModalDesc;
    }
  };

  const saveIdToken = (token) => {
    googleIdToken = token || '';

    if (googleIdToken) {
      window.sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, googleIdToken);
      window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, googleIdToken);
    } else {
      window.sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    }
  };

  const isExpiredAuthError = (message = '') => /invalid value|google token verification failed|idtoken is required/i.test(String(message || '').trim());

  const createReloginError = (message = '로그인 세션이 만료되었습니다. 다시 로그인해 주세요.') => {
    clearUser();
    saveIdToken('');
    renderUser(null);
    openAuthModal(message, 'error');
    return new Error(message);
  };

  const loadLocalQuestions = () => {
    try {
      const raw = window.localStorage.getItem(QUESTION_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('Failed to parse question state', error);
      return [];
    }
  };

  const normalizeAttachment = (item) => {
    if (!item) return null;

    const inferredType = inferAttachmentTypeFromName(item.name || item.fileName || '');
    const contentType = String(item.contentType || item.type || inferredType || 'application/octet-stream');
    const url = item.url || item.webViewUrl || item.webContentLink || item.dataUrl || '';
    const previewUrl = item.previewUrl || (isImageAttachmentType(contentType) ? (item.dataUrl || item.url || item.webContentLink || item.webViewUrl || '') : '');
    const name = String(item.name || item.fileName || 'attachment');

    if (!url) return null;

    return {
      name,
      url: String(url),
      previewUrl: String(previewUrl || ''),
      contentType,
      fileId: item.fileId || ''
    };
  };

  const sanitizeAttachments = (attachments) => Array.isArray(attachments)
    ? attachments.map(normalizeAttachment).filter(Boolean)
    : [];

  const getAttachmentFingerprint = (attachment) => [
    attachment.name || '',
    attachment.url || '',
    attachment.contentType || '',
    attachment.fileId || ''
  ].join('||');

  const mergeAttachmentLists = (primaryAttachments = [], secondaryAttachments = []) => {
    const mergedMap = new Map();

    [...sanitizeAttachments(primaryAttachments), ...sanitizeAttachments(secondaryAttachments)].forEach((attachment) => {
      const fingerprint = getAttachmentFingerprint(attachment);
      if (!mergedMap.has(fingerprint)) {
        mergedMap.set(fingerprint, attachment);
      }
    });

    return Array.from(mergedMap.values());
  };

  const normalizeReply = (item) => {
    if (!item || !item.questionId || !item.content) return null;

    const attachments = mergeAttachmentLists(item.attachments || item.images || []);

    return {
      id: String(item.id || item.replyId || `${item.questionId}-${item.createdAt || Date.now()}`),
      questionId: String(item.questionId),
      content: String(item.content),
      createdAt: item.createdAt || item.timestamp || new Date().toISOString(),
      authorName: item.authorName || item.name || 'Siemens User',
      authorEmail: item.authorEmail || item.email || '',
      authorPicture: item.authorPicture || item.picture || '',
      attachments
    };
  };

  const sanitizeReplies = (replies) => Array.isArray(replies)
    ? replies.map(normalizeReply).filter(Boolean)
    : [];

  const getReplyFingerprint = (reply) => [
    reply.id || '',
    reply.questionId || '',
    reply.content || '',
    reply.authorEmail || '',
    reply.createdAt || ''
  ].join('||');

  const mergeReplyObjects = (baseReply = {}, incomingReply = {}) => {
    const attachments = mergeAttachmentLists(baseReply.attachments || [], incomingReply.attachments || []);

    return {
      ...baseReply,
      ...incomingReply,
      attachments,
      createdAt: incomingReply.createdAt || baseReply.createdAt || new Date().toISOString()
    };
  };

  const mergeReplyLists = (primaryReplies = [], secondaryReplies = []) => {
    const mergedMap = new Map();

    [...sanitizeReplies(primaryReplies), ...sanitizeReplies(secondaryReplies)].forEach((reply) => {
      const fingerprint = getReplyFingerprint(reply);
      const existing = mergedMap.get(fingerprint);
      mergedMap.set(fingerprint, existing ? mergeReplyObjects(existing, reply) : reply);
    });

    return Array.from(mergedMap.values()).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  };

  const normalizeQuestion = (item) => {
    if (!item || !item.category || !item.title || !item.content) return null;

    const replies = mergeReplyLists(item.replies || [], []);
    const explicitReplyCount = Number(item.replyCount || 0);
    const rawContent = String(item.rawContent || item.content || '');
    const parsedPayload = parseQuestionContentPayload(item.category, rawContent);
    const resourceLink = normalizeResourceLink(item.resourceLink || parsedPayload.resourceLink || '');
    const content = String(item.displayContent || parsedPayload.content || '').trim();

    return {
      id: String(item.id || item.questionId || `${item.category}-${item.title}-${item.createdAt || Date.now()}`),
      category: String(item.category),
      title: String(item.title),
      content,
      rawContent: buildQuestionContentPayload(item.category, content, resourceLink),
      resourceLink,
      createdAt: item.createdAt || item.timestamp || new Date().toISOString(),
      authorName: item.authorName || item.name || 'Siemens User',
      authorEmail: item.authorEmail || item.email || '',
      authorPicture: item.authorPicture || item.picture || '',
      replies,
      replyCount: Math.max(explicitReplyCount, replies.length)
    };
  };

  const sanitizeQuestions = (questions) => Array.isArray(questions)
    ? questions.map(normalizeQuestion).filter(Boolean)
    : [];

  const getQuestionFingerprint = (question) => [
    question.id || '',
    question.category || '',
    question.title || '',
    question.rawContent || buildQuestionContentPayload(question.category, question.content, question.resourceLink) || '',
    question.authorEmail || '',
    question.createdAt || ''
  ].join('||');

  const getQuestionLastActivityAt = (question) => {
    const replies = sanitizeReplies(question?.replies || []);
    const latestReply = replies[replies.length - 1];
    return latestReply?.createdAt || question?.createdAt || '';
  };

  const mergeQuestionObjects = (baseQuestion = {}, incomingQuestion = {}) => {
    const replies = mergeReplyLists(baseQuestion.replies || [], incomingQuestion.replies || []);
    const explicitReplyCount = Math.max(Number(baseQuestion.replyCount || 0), Number(incomingQuestion.replyCount || 0));

    return {
      ...baseQuestion,
      ...incomingQuestion,
      replies,
      replyCount: Math.max(explicitReplyCount, replies.length),
      createdAt: incomingQuestion.createdAt || baseQuestion.createdAt || new Date().toISOString()
    };
  };

  const mergeQuestionLists = (primaryQuestions = [], secondaryQuestions = []) => {
    const mergedMap = new Map();

    [...sanitizeQuestions(primaryQuestions), ...sanitizeQuestions(secondaryQuestions)].forEach((question) => {
      const fingerprint = getQuestionFingerprint(question);
      const existing = mergedMap.get(fingerprint);
      mergedMap.set(fingerprint, existing ? mergeQuestionObjects(existing, question) : question);
    });

    return Array.from(mergedMap.values()).sort((a, b) => new Date(getQuestionLastActivityAt(b)).getTime() - new Date(getQuestionLastActivityAt(a)).getTime());
  };

  const loadQuestions = () => questionStore;

  const saveQuestions = (questions, { persistLocal = true } = {}) => {
    questionStore = sanitizeQuestions(questions);

    if (persistLocal) {
      window.localStorage.setItem(QUESTION_STORAGE_KEY, JSON.stringify(questionStore));
    }
  };

  const upsertQuestionInStore = (question, { persistLocal = true } = {}) => {
    saveQuestions(mergeQuestionLists([question], loadQuestions()), { persistLocal });
  };

  const removeQuestionFromStore = (questionId, { persistLocal = true } = {}) => {
    saveQuestions(loadQuestions().filter((question) => String(question.id) !== String(questionId)), { persistLocal });
  };

  const findQuestionInStore = (questionId) => loadQuestions().find((question) => String(question.id) === String(questionId)) || null;

  const ADMIN_EMAILS = new Set(['allthatsiemens@gmail.com']);

  const normalizeUserEmail = (value = '') => String(value || '').trim().toLowerCase();

  const isSameUserEmail = (left = '', right = '') => normalizeUserEmail(left) === normalizeUserEmail(right);

  const isAdminUserEmail = (email = '') => ADMIN_EMAILS.has(normalizeUserEmail(email));

  const canManagePost = (authorEmail = '') => Boolean(currentUser?.email && (isAdminUserEmail(currentUser.email) || isSameUserEmail(currentUser.email, authorEmail)));

  const updateReplyInStore = (updatedReply, { persistLocal = true } = {}) => {
    const question = findQuestionInStore(updatedReply?.questionId);
    if (!question) return;

    const replies = mergeReplyLists((question.replies || []).map((reply) => (
      String(reply.id) === String(updatedReply.id) ? { ...reply, ...updatedReply } : reply
    )), []);

    upsertQuestionInStore({
      ...question,
      replies,
      replyCount: Math.max(Number(question.replyCount || 0), replies.length)
    }, { persistLocal });
  };

  const removeReplyFromStore = (questionId, replyId, { persistLocal = true } = {}) => {
    const question = findQuestionInStore(questionId);
    if (!question) return;

    const replies = mergeReplyLists((question.replies || []).filter((reply) => String(reply.id) !== String(replyId)), []);
    upsertQuestionInStore({
      ...question,
      replies,
      replyCount: replies.length
    }, { persistLocal });
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

  const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`${file.name} 파일을 읽지 못했습니다.`));
    reader.readAsDataURL(file);
  });

  const prepareReplyAttachments = async (fileList) => {
    const files = Array.from(fileList || []);

    if (!files.length) return [];
    if (files.length > MAX_REPLY_ATTACHMENTS) {
      throw new Error(`파일은 최대 ${MAX_REPLY_ATTACHMENTS}개까지 첨부할 수 있습니다.`);
    }

    const payloads = await Promise.all(files.map(async (file) => {
      const detectedType = file.type || inferAttachmentTypeFromName(file.name);
      if (!isAllowedReplyAttachmentType(detectedType, file.name)) {
        throw new Error('이미지 또는 PDF 파일만 첨부할 수 있습니다.');
      }

      const maxBytes = MAX_ATTACHMENT_SIZE_MB * 1024 * 1024;
      if (file.size > maxBytes) {
        throw new Error(`${file.name} 파일은 ${MAX_ATTACHMENT_SIZE_MB}MB 이하만 업로드할 수 있습니다.`);
      }

      const dataUrl = await readFileAsDataUrl(file);

      return {
        name: file.name,
        contentType: detectedType || 'application/octet-stream',
        dataUrl
      };
    }));

    return payloads;
  };

  const fetchQuestionsFromServer = async () => {
    if (!APPS_SCRIPT_URL) return null;

    const response = await fetch(QUESTION_API_ENDPOINT, {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      },
      cache: 'no-store'
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || '게시글 목록을 불러오지 못했습니다.');
    }

    return sanitizeQuestions(data.questions || []);
  };

  const createQuestionOnServer = async (question) => {
    if (!APPS_SCRIPT_URL) return null;
    if (!googleIdToken) throw new Error('다시 로그인한 뒤 질문을 등록해 주세요.');

    const response = await fetch(QUESTION_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'createQuestion',
        idToken: googleIdToken,
        question: {
          ...question,
          content: buildQuestionContentPayload(question.category, question.content, question.resourceLink)
        }
      })
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      if (isExpiredAuthError(data.error)) {
        throw createReloginError('로그인 세션이 만료되었습니다. 다시 로그인한 뒤 질문을 등록해 주세요.');
      }
      throw new Error(data.error || '게시글 저장에 실패했습니다.');
    }

    return normalizeQuestion(data.question || question);
  };

  const createReplyOnServer = async (reply) => {
    if (!APPS_SCRIPT_URL) return null;
    if (!googleIdToken) throw new Error('다시 로그인한 뒤 답변을 등록해 주세요.');

    const response = await fetch(QUESTION_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'createReply',
        idToken: googleIdToken,
        reply
      })
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      if (isExpiredAuthError(data.error)) {
        throw createReloginError('로그인 세션이 만료되었습니다. 다시 로그인한 뒤 답변을 등록해 주세요.');
      }
      throw new Error(data.error || '답변 저장에 실패했습니다.');
    }

    return {
      reply: normalizeReply(data.reply || reply),
      question: normalizeQuestion(data.question || null)
    };
  };

  const updateQuestionOnServer = async (questionId, question) => {
    if (!APPS_SCRIPT_URL) return null;
    if (!googleIdToken) throw new Error('다시 로그인한 뒤 질문을 수정해 주세요.');

    const response = await fetch(QUESTION_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'updateQuestion',
        idToken: googleIdToken,
        questionId,
        question: {
          ...question,
          content: buildQuestionContentPayload(question.category, question.content, question.resourceLink)
        }
      })
    });

    const data = await response.json();
    if (!response.ok || !data.ok) {
      if (isExpiredAuthError(data.error)) {
        throw createReloginError('로그인 세션이 만료되었습니다. 다시 로그인한 뒤 질문을 수정해 주세요.');
      }
      throw new Error(data.error || '질문 수정에 실패했습니다.');
    }

    return normalizeQuestion(data.question || { id: questionId, ...question });
  };

  const deleteQuestionOnServer = async (questionId) => {
    if (!APPS_SCRIPT_URL) return null;
    if (!googleIdToken) throw new Error('다시 로그인한 뒤 질문을 삭제해 주세요.');

    const response = await fetch(QUESTION_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'deleteQuestion',
        idToken: googleIdToken,
        questionId
      })
    });

    const data = await response.json();
    if (!response.ok || !data.ok) {
      if (isExpiredAuthError(data.error)) {
        throw createReloginError('로그인 세션이 만료되었습니다. 다시 로그인한 뒤 질문을 삭제해 주세요.');
      }
      throw new Error(data.error || '질문 삭제에 실패했습니다.');
    }

    return data.deletedQuestionId || questionId;
  };

  const updateReplyOnServer = async (replyId, reply) => {
    if (!APPS_SCRIPT_URL) return null;
    if (!googleIdToken) throw new Error('다시 로그인한 뒤 답변을 수정해 주세요.');

    const response = await fetch(QUESTION_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'updateReply',
        idToken: googleIdToken,
        replyId,
        reply
      })
    });

    const data = await response.json();
    if (!response.ok || !data.ok) {
      if (isExpiredAuthError(data.error)) {
        throw createReloginError('로그인 세션이 만료되었습니다. 다시 로그인한 뒤 답변을 수정해 주세요.');
      }
      throw new Error(data.error || '답변 수정에 실패했습니다.');
    }

    return {
      reply: normalizeReply(data.reply || { id: replyId, ...reply }),
      question: normalizeQuestion(data.question || null)
    };
  };

  const deleteReplyOnServer = async (replyId, questionId) => {
    if (!APPS_SCRIPT_URL) return null;
    if (!googleIdToken) throw new Error('다시 로그인한 뒤 답변을 삭제해 주세요.');

    const response = await fetch(QUESTION_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'deleteReply',
        idToken: googleIdToken,
        replyId,
        questionId
      })
    });

    const data = await response.json();
    if (!response.ok || !data.ok) {
      if (isExpiredAuthError(data.error)) {
        throw createReloginError('로그인 세션이 만료되었습니다. 다시 로그인한 뒤 답변을 삭제해 주세요.');
      }
      throw new Error(data.error || '답변 삭제에 실패했습니다.');
    }

    return {
      deletedReplyId: data.deletedReplyId || replyId,
      questionId: data.questionId || questionId,
      question: normalizeQuestion(data.question || null)
    };
  };

  const migrateQuestionsToServer = async (questions) => {
    if (!APPS_SCRIPT_URL || !googleIdToken || !questions.length) return null;

    const response = await fetch(QUESTION_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'migrateQuestions',
        idToken: googleIdToken,
        questions
      })
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      if (isExpiredAuthError(data.error)) {
        throw createReloginError('로그인 세션이 만료되었습니다. 다시 로그인해 주세요.');
      }
      throw new Error(data.error || '기존 게시글 이전에 실패했습니다.');
    }

    return sanitizeQuestions(data.questions || []);
  };

  const syncQuestionsFromServer = async () => {
    if (!APPS_SCRIPT_URL) return false;

    try {
      const remoteQuestions = await fetchQuestionsFromServer();
      saveQuestions(mergeQuestionLists(remoteQuestions, loadLocalQuestions()));
      usingRemoteQuestionStore = true;
      return true;
    } catch (error) {
      console.error('Failed to sync questions from Google Sheet', error);
      usingRemoteQuestionStore = false;
      return false;
    }
  };

  const maybeMigrateLocalQuestions = async () => {
    const localQuestions = loadLocalQuestions();

    if (!APPS_SCRIPT_URL || !googleIdToken || !localQuestions.length) return false;
    if (window.localStorage.getItem(MIGRATION_STORAGE_KEY) === 'done') return false;

    try {
      const remoteQuestions = await migrateQuestionsToServer(localQuestions);
      saveQuestions(mergeQuestionLists(remoteQuestions, localQuestions));
      usingRemoteQuestionStore = true;
      window.localStorage.setItem(MIGRATION_STORAGE_KEY, 'done');
      return true;
    } catch (error) {
      console.error('Failed to migrate local questions to Google Sheet', error);
      return false;
    }
  };

  const bootstrapQuestionStore = async () => {
    saveQuestions(loadLocalQuestions());
    refreshQuestionDrivenUI();

    const remoteLoaded = await syncQuestionsFromServer();
    if (remoteLoaded) {
      refreshQuestionDrivenUI();
    }

    if (currentUser) {
      const migrated = await maybeMigrateLocalQuestions();
      if (migrated) {
        await syncQuestionsFromServer();
        refreshQuestionDrivenUI();
      }
    }
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
      return cloned.sort((a, b) => Number(b.replyCount || b.replies?.length || 0) - Number(a.replyCount || a.replies?.length || 0));
    }

    return cloned.sort((a, b) => new Date(getQuestionLastActivityAt(b)).getTime() - new Date(getQuestionLastActivityAt(a)).getTime());
  };

  const getCategoryQuestions = (category) => loadQuestions().filter((question) => question.category === category);

  const normalizeSearchQuery = (query = '') => String(query || '').trim().toLowerCase();

  const getSearchTokens = (query = '') => normalizeSearchQuery(query)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  const buildQuestionSearchText = (question) => {
    const replies = Array.isArray(question?.replies) ? question.replies : [];
    const replyText = replies.map((reply) => [
      reply?.content || '',
      reply?.authorName || '',
      reply?.authorEmail || '',
      ...(Array.isArray(reply?.attachments) ? reply.attachments.map((attachment) => attachment?.name || '') : [])
    ].join(' ')).join(' ');

    return [
      question?.category || '',
      question?.title || '',
      question?.content || '',
      question?.resourceLink || '',
      question?.authorName || '',
      question?.authorEmail || '',
      replyText
    ].join(' ').toLowerCase();
  };

  const matchesSearchQuery = (text = '', query = '') => {
    const normalizedText = String(text || '').toLowerCase();
    const tokens = getSearchTokens(query);
    if (!tokens.length) return true;
    return tokens.every((token) => normalizedText.includes(token));
  };

  const filterQuestionsBySearch = (questions, query = '') => {
    if (!normalizeSearchQuery(query)) return questions;
    return questions.filter((question) => matchesSearchQuery(buildQuestionSearchText(question), query));
  };

  const renderHomepageCategorySearch = () => {
    if (CURRENT_FORUM_CATEGORY || !categoryCards.length) return;

    const query = normalizeSearchQuery(activeSearchQuery);
    const matchedQuestions = filterQuestionsBySearch(loadQuestions(), query);

    categoryCards.forEach((card) => {
      const categoryName = CATEGORY_BY_SECTION_ID[card.id] || '';
      const categoryText = `${categoryName} ${card.textContent || ''}`;
      const hasMatchedQuestion = matchedQuestions.some((question) => question.category === categoryName);
      const visible = !query || hasMatchedQuestion || matchesSearchQuery(categoryText, query);
      card.hidden = !visible;
      card.style.display = visible ? '' : 'none';
    });
  };

  const executeSearch = (query = '', { scrollToResults = true } = {}) => {
    activeSearchQuery = String(query || '').trim();

    if (heroSearchInput && heroSearchInput.value !== activeSearchQuery) {
      heroSearchInput.value = activeSearchQuery;
    }
    if (miniSearchInput && miniSearchInput.value !== activeSearchQuery) {
      miniSearchInput.value = activeSearchQuery;
    }

    refreshQuestionDrivenUI();

    if (!scrollToResults) return;

    const searchTarget = CURRENT_FORUM_CATEGORY
      ? forumQuestionList?.querySelector('.topic-card, .reply-form') || forumQuestionEmptyState
      : questionList?.querySelector('.question-card, .reply-form') || Array.from(categoryCards).find((card) => !card.hidden) || questionEmptyState;

    searchTarget?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const clearSearch = ({ scrollToResults = false } = {}) => {
    executeSearch('', { scrollToResults });
  };

  const getCategoryStats = (category) => {
    const questions = getCategoryQuestions(category);
    const latestQuestion = getSortedQuestions(questions, 'latest')[0] || null;

    return {
      topics: questions.length,
      replies: questions.reduce((total, question) => total + Number(question.replyCount || question.replies?.length || 0), 0),
      latestQuestion,
      latestActivityAt: latestQuestion ? getQuestionLastActivityAt(latestQuestion) : ''
    };
  };

  const buildAttachmentGallery = (attachments = []) => {
    const normalized = sanitizeAttachments(attachments);
    if (!normalized.length) return '';

    return `
      <div class="reply-attachment-gallery">
        ${normalized.map((attachment) => {
          const isImage = isImageAttachmentType(attachment.contentType);
          const badgeText = isPdfAttachmentType(attachment.contentType) ? 'PDF' : 'FILE';

          if (isImage) {
            const previewUrl = attachment.previewUrl || attachment.url;
            return `
              <a class="reply-attachment-link" href="${escapeHtml(attachment.url)}" target="_blank" rel="noopener noreferrer">
                <img src="${escapeHtml(previewUrl)}" alt="${escapeHtml(attachment.name || '첨부 파일')}" loading="lazy" referrerpolicy="no-referrer">
                <span>${escapeHtml(attachment.name || '첨부 파일')}</span>
              </a>
            `;
          }

          return `
            <a class="reply-attachment-link is-file" href="${escapeHtml(attachment.url)}" target="_blank" rel="noopener noreferrer">
              <div class="reply-attachment-file-badge">${badgeText}</div>
              <span>${escapeHtml(attachment.name || '첨부 파일')}</span>
            </a>
          `;
        }).join('')}
      </div>
    `;
  };

  const buildPostManageActions = (type, item, questionId = '') => {
    if (!canManagePost(item?.authorEmail)) return '';

    if (type === 'question') {
      return `
        <div class="post-manage-actions" aria-label="질문 관리">
          <button type="button" class="post-manage-btn" data-action="edit-question" data-question-id="${escapeHtml(item.id)}">수정</button>
          <button type="button" class="post-manage-btn danger" data-action="delete-question" data-question-id="${escapeHtml(item.id)}">삭제</button>
        </div>
      `;
    }

    return `
      <div class="post-manage-actions" aria-label="답변 관리">
        <button type="button" class="post-manage-btn" data-action="edit-reply" data-question-id="${escapeHtml(questionId)}" data-reply-id="${escapeHtml(item.id)}">수정</button>
        <button type="button" class="post-manage-btn danger" data-action="delete-reply" data-question-id="${escapeHtml(questionId)}" data-reply-id="${escapeHtml(item.id)}">삭제</button>
      </div>
    `;
  };

  const buildReplyCard = (reply) => `
    <article class="reply-card" data-reply-id="${escapeHtml(reply.id)}">
      <div class="reply-card-top">
        <div class="reply-author">
          <img src="${escapeHtml(reply.authorPicture || 'https://www.gstatic.com/images/branding/product/1x/avatar_circle_blue_512dp.png')}" alt="${escapeHtml(reply.authorName || '사용자')} 프로필" referrerpolicy="no-referrer">
          <div>
            <strong>${escapeHtml(reply.authorName || 'Siemens User')}</strong>
            <span>${escapeHtml(reply.authorEmail || '')}</span>
          </div>
        </div>
        <div class="post-manage-group">
          <time class="reply-date">${escapeHtml(formatDateTime(reply.createdAt))}</time>
          ${buildPostManageActions('reply', reply, reply.questionId)}
        </div>
      </div>
      <p class="reply-content-text">${escapeHtml(reply.content)}</p>
      ${buildAttachmentGallery(reply.attachments || [])}
    </article>
  `;

  const buildReplyComposer = (questionId) => {
    const isLoggedIn = Boolean(currentUser && currentUser.email);
    const placeholder = isLoggedIn
      ? '답변을 입력해 주세요. 현장 사진, 화면 캡처, PDF 파일도 함께 첨부할 수 있습니다.'
      : '로그인 후 답변을 작성할 수 있습니다.';

    return `
      <form class="reply-form" data-question-id="${escapeHtml(questionId)}">
        <label class="field-group reply-field-group">
          <span>답변 작성</span>
          <textarea class="reply-content-input" rows="4" maxlength="1500" placeholder="${escapeHtml(placeholder)}" ${isLoggedIn ? '' : 'disabled'}></textarea>
        </label>
        <div class="reply-form-toolbar">
          <label class="reply-file-label ${isLoggedIn ? '' : 'is-disabled'}">
            <input class="reply-file-input" type="file" accept="image/*,.pdf,application/pdf" multiple ${isLoggedIn ? '' : 'disabled'}>
            <span>파일 첨부</span>
          </label>
          <span class="reply-file-hint">이미지/PDF, 최대 ${MAX_REPLY_ATTACHMENTS}개 · 각 ${MAX_ATTACHMENT_SIZE_MB}MB</span>
        </div>
        <div class="reply-file-list" aria-live="polite"></div>
        <div class="reply-form-actions">
          ${isLoggedIn
            ? '<button type="submit" class="btn-primary reply-submit-btn">답변 등록</button>'
            : '<button type="button" class="btn-secondary reply-login-btn">로그인 후 답변하기</button>'}
          <p class="reply-status" aria-live="polite"></p>
        </div>
      </form>
    `;
  };

  const buildRepliesSection = (question) => {
    const replies = mergeReplyLists(question.replies || [], []);
    const summaryText = replies.length
      ? `답변 ${replies.length}개 · 마지막 업데이트 ${formatRelativeTime(getQuestionLastActivityAt(question))}`
      : '아직 등록된 답변이 없습니다. 첫 답변을 남겨보세요.';

    return `
      <section class="reply-section" aria-label="${escapeHtml(question.title)} 답변 영역">
        <div class="reply-section-head">
          <strong>Replies ${Number(question.replyCount || replies.length)}</strong>
          <span>${escapeHtml(summaryText)}</span>
        </div>
        <div class="reply-list ${replies.length ? '' : 'is-empty'}">
          ${replies.length ? replies.map(buildReplyCard).join('') : '<div class="reply-empty-state">아직 등록된 답변이 없습니다.</div>'}
        </div>
        ${buildReplyComposer(question.id)}
      </section>
    `;
  };

  const buildCommunityQuestionCard = (question) => `
    <article class="question-card" data-question-id="${escapeHtml(question.id)}">
      <div class="question-card-meta">
        <span class="question-category">${escapeHtml(question.category)}</span>
        <div class="post-manage-group">
          <span class="question-date">${escapeHtml(formatDateTime(question.createdAt))}</span>
          ${buildPostManageActions('question', question)}
        </div>
      </div>
      <h3>${escapeHtml(question.title)}</h3>
      <p>${formatRichText(question.content)}</p>
      ${buildQuestionResourceLink(question)}
      <div class="question-author-row">
        <img src="${escapeHtml(question.authorPicture || 'https://www.gstatic.com/images/branding/product/1x/avatar_circle_blue_512dp.png')}" alt="${escapeHtml(question.authorName || '사용자')} 프로필" referrerpolicy="no-referrer">
        <div>
          <strong>${escapeHtml(question.authorName || 'Siemens User')}</strong>
          <span>${escapeHtml(question.authorEmail || '')}</span>
        </div>
      </div>
      ${buildRepliesSection(question)}
    </article>
  `;

  const buildForumTopicCard = (question, index) => {
    const hasReplies = Number(question.replyCount || question.replies?.length || 0) > 0;
    const topicStatusLabel = hasReplies ? 'Close' : 'Open';
    const topicStatusClass = hasReplies ? 'is-close' : 'is-open';

    return `
    <article class="topic-card ${index === 0 ? 'featured-topic-card' : ''}" data-question-id="${escapeHtml(question.id)}">
      <div class="topic-card-top">
        <span class="topic-status ${topicStatusClass}">${topicStatusLabel}</span>
        <div class="post-manage-group">
          <span class="topic-updated">Updated ${escapeHtml(formatRelativeTime(getQuestionLastActivityAt(question)))}</span>
          ${buildPostManageActions('question', question)}
        </div>
      </div>
      <h3>${escapeHtml(question.title)}</h3>
      <p>${formatRichText(question.content)}</p>
      ${buildQuestionResourceLink(question)}
      <div class="topic-meta-row">
        <span>작성자: ${escapeHtml(question.authorName || 'Siemens User')}</span>
        <span>이메일: ${escapeHtml(question.authorEmail || '-')}</span>
        <span>Replies: ${Number(question.replyCount || question.replies?.length || 0)}</span>
      </div>
      ${buildRepliesSection(question)}
    </article>
  `;
  };

  const renderCommunityQuestions = () => {
    if (!questionList || !questionEmptyState) return;

    const searchQuery = normalizeSearchQuery(activeSearchQuery);
    const questions = getSortedQuestions(filterQuestionsBySearch(loadQuestions(), searchQuery), 'latest');
    questionList.innerHTML = '';

    if (memberPostsDesc) {
      memberPostsDesc.textContent = searchQuery
        ? `검색어 "${activeSearchQuery}" 결과입니다. 질문 ${questions.length}건이 표시됩니다.`
        : defaultMemberPostsDesc;
    }

    if (!questions.length) {
      questionEmptyState.textContent = searchQuery
        ? `"${activeSearchQuery}" 검색 결과가 없습니다. 다른 키워드로 다시 검색해 주세요.`
        : defaultQuestionEmptyMessage;
      questionEmptyState.classList.remove('is-hidden');
      return;
    }

    questionEmptyState.classList.add('is-hidden');
    questionList.innerHTML = questions.map(buildCommunityQuestionCard).join('');
  };

  const updateCommunityForumCount = () => {
    if (!communityForumCount) return;
    const totalTopics = loadQuestions().length;
    communityForumCount.textContent = `(${totalTopics.toLocaleString('en-US')})`;
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
      if (values[2]) values[2].textContent = formatRelativeTime(stats.latestActivityAt);
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

    const searchQuery = normalizeSearchQuery(activeSearchQuery);
    const questions = getSortedQuestions(filterQuestionsBySearch(getCategoryQuestions(CURRENT_FORUM_CATEGORY), searchQuery), sortType);
    forumQuestionList.innerHTML = '';

    if (!questions.length) {
      forumQuestionEmptyState.textContent = searchQuery
        ? `"${activeSearchQuery}" 검색 결과가 없습니다. 다른 키워드로 다시 검색해 주세요.`
        : defaultForumEmptyMessage;
      forumQuestionEmptyState.classList.remove('is-hidden');
    } else {
      forumQuestionEmptyState.classList.add('is-hidden');
      forumQuestionList.innerHTML = questions.map(buildForumTopicCard).join('');
    }

    const titleNode = document.getElementById('currentTopicsTitle');
    if (titleNode) {
      titleNode.textContent = searchQuery
        ? `${CURRENT_FORUM_CATEGORY} Questions · 검색 결과 ${questions.length}건`
        : `${CURRENT_FORUM_CATEGORY} Questions`;
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
      if (strong) strong.textContent = formatRelativeTime(stats.latestActivityAt);
      if (label) label.textContent = 'Last Update';
    }

    const overviewRecentActivity = document.querySelector('.forum-side-list li:last-child strong');
    if (overviewRecentActivity) {
      overviewRecentActivity.textContent = formatRelativeTime(stats.latestActivityAt);
    }
  };

  const refreshQuestionDrivenUI = () => {
    renderCommunityQuestions();
    renderHomepageCategorySearch();
    updateCommunityForumCount();
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

  const openQuestionModal = (question = null) => {
    questionModal?.classList.remove('is-hidden');
    document.body.classList.add('modal-open');
    setQuestionStatus('', 'default');
    if (questionForm) {
      questionForm.reset();
    }

    editingQuestionId = question?.id ? String(question.id) : '';

    if (questionModalTitle) {
      questionModalTitle.textContent = editingQuestionId ? '질문 수정' : defaultQuestionModalTitle;
    }
    if (questionModalDesc) {
      questionModalDesc.textContent = editingQuestionId
        ? '작성한 질문의 카테고리, 제목, 내용을 수정한 뒤 저장해 주세요.'
        : defaultQuestionModalDesc;
    }
    if (questionSubmitButton) {
      questionSubmitButton.textContent = editingQuestionId ? '수정 저장' : defaultQuestionSubmitLabel;
    }

    if (questionCategoryField) {
      questionCategoryField.value = question?.category || CURRENT_FORUM_CATEGORY || '';
    }
    if (questionTitleField) {
      questionTitleField.value = question?.title || '';
    }
    if (questionResourceLinkField) {
      questionResourceLinkField.value = question?.resourceLink || '';
    }
    if (questionContentField) {
      questionContentField.value = question?.content || '';
    }

    updateQuestionResourceLinkVisibility();
  };

  const closeQuestionModal = () => {
    questionModal?.classList.add('is-hidden');
    editingQuestionId = '';
    if (questionModalTitle) questionModalTitle.textContent = defaultQuestionModalTitle;
    if (questionModalDesc) questionModalDesc.textContent = defaultQuestionModalDesc;
    if (questionSubmitButton) questionSubmitButton.textContent = defaultQuestionSubmitLabel;
    if (questionResourceLinkField) questionResourceLinkField.value = '';
    updateQuestionResourceLinkVisibility();
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
      askAccessHint.textContent = `${currentUser.name || '회원'}님, 질문과 답변을 작성할 수 있습니다.`;
    } else {
      askCommunityBtn.classList.add('member-locked');
      askCommunityBtn.textContent = 'Ask the Community · 회원 전용';
      askAccessHint.textContent = '회원 전용 기능입니다. 로그인 후 질문과 답변을 작성할 수 있습니다.';
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
    refreshQuestionDrivenUI();
  };

  const handleLogout = () => {
    clearUser();
    saveIdToken('');
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
      saveIdToken(credential);
      saveUser(result.user);
      renderUser(result.user);
      await maybeMigrateLocalQuestions();
      await syncQuestionsFromServer();
      refreshQuestionDrivenUI();

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

  const handleQuestionSubmit = async (event) => {
    event.preventDefault();

    if (!currentUser) {
      closeQuestionModal();
      pendingProtectedAction = 'ask';
      openAuthModal('로그인 상태가 필요합니다. 다시 로그인해 주세요.', 'error');
      return;
    }

    const category = questionCategoryField?.value?.trim();
    const title = questionTitleField?.value?.trim();
    const resourceLink = normalizeResourceLink(questionResourceLinkField?.value || '');
    const rawResourceLinkInput = String(questionResourceLinkField?.value || '').trim();
    const content = questionContentField?.value?.trim();

    if (!category || !title || !content) {
      setQuestionStatus('카테고리, 제목, 내용을 모두 입력해 주세요.', 'error');
      return;
    }

    if (isDataSheetCategory(category) && rawResourceLinkInput && !resourceLink) {
      setQuestionStatus('자료 링크는 http 또는 https로 시작하는 올바른 URL을 입력해 주세요.', 'error');
      questionResourceLinkField?.focus();
      return;
    }

    if (editingQuestionId) {
      const existingQuestion = findQuestionInStore(editingQuestionId);
      if (!existingQuestion) {
        setQuestionStatus('수정할 질문을 찾지 못했습니다. 페이지를 새로고침해 주세요.', 'error');
        return;
      }

      if (!canManagePost(existingQuestion.authorEmail)) {
        setQuestionStatus('작성자 또는 관리자만 질문을 수정할 수 있습니다.', 'error');
        return;
      }

      const updatedDraft = {
        ...existingQuestion,
        category,
        title,
        content,
        resourceLink,
        rawContent: buildQuestionContentPayload(category, content, resourceLink)
      };

      try {
        const updatedQuestion = APPS_SCRIPT_URL
          ? await updateQuestionOnServer(editingQuestionId, { category, title, content, resourceLink })
          : updatedDraft;

        upsertQuestionInStore(updatedQuestion || updatedDraft);
        refreshQuestionDrivenUI();
        setQuestionStatus('질문이 수정되었습니다.', 'success');

        window.setTimeout(() => {
          closeQuestionModal();
          document.querySelector(`[data-question-id="${CSS.escape(String(editingQuestionId))}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 500);
      } catch (error) {
        console.error(error);
        setQuestionStatus(error.message || '질문 수정 중 오류가 발생했습니다.', 'error');
      }

      return;
    }

    const draftQuestion = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      category,
      title,
      content,
      rawContent: buildQuestionContentPayload(category, content, resourceLink),
      resourceLink,
      createdAt: new Date().toISOString(),
      authorName: currentUser.name || 'Siemens User',
      authorEmail: currentUser.email || '',
      authorPicture: currentUser.picture || '',
      replies: [],
      replyCount: 0
    };

    try {
      let latestQuestions = mergeQuestionLists([draftQuestion], loadQuestions());

      if (APPS_SCRIPT_URL) {
        const storedQuestion = await createQuestionOnServer(draftQuestion);
        usingRemoteQuestionStore = true;
        const remoteQuestions = await fetchQuestionsFromServer().catch(() => [storedQuestion]);
        latestQuestions = mergeQuestionLists(remoteQuestions, latestQuestions);
      }

      saveQuestions(latestQuestions);
      refreshQuestionDrivenUI();
      setQuestionStatus('질문이 등록되었습니다.', 'success');
    } catch (error) {
      console.error(error);
      saveQuestions(mergeQuestionLists([draftQuestion], loadQuestions()));
      refreshQuestionDrivenUI();
      setQuestionStatus('서버 연결에 실패하여 현재 브라우저에 임시 저장했습니다. 다시 로그인 후 자동 이전할 수 있습니다.', 'error');
    }

    window.setTimeout(() => {
      closeQuestionModal();
      const targetList = forumQuestionList || questionList;
      targetList?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 500);
  };

  const updateReplyFileList = (input) => {
    const form = input.closest('.reply-form');
    const fileListNode = form?.querySelector('.reply-file-list');
    if (!fileListNode) return;

    const files = Array.from(input.files || []);
    if (!files.length) {
      fileListNode.innerHTML = '';
      return;
    }

    fileListNode.innerHTML = files.map((file) => `
      <span class="reply-file-chip">${escapeHtml(file.name)} · ${(file.size / 1024 / 1024).toFixed(1)}MB</span>
    `).join('');
  };

  const handleReplySubmit = async (form) => {
    const questionId = form.dataset.questionId;
    const contentInput = form.querySelector('.reply-content-input');
    const fileInput = form.querySelector('.reply-file-input');
    const statusNode = form.querySelector('.reply-status');
    const submitButton = form.querySelector('.reply-submit-btn');

    if (!currentUser) {
      pendingProtectedAction = null;
      openAuthModal('답변 작성은 회원 전용입니다. 먼저 Google 로그인해 주세요.', 'default');
      return;
    }

    const content = contentInput?.value?.trim() || '';
    if (!questionId || !content) {
      if (statusNode) {
        statusNode.textContent = '답변 내용을 입력해 주세요.';
        statusNode.dataset.state = 'error';
      }
      return;
    }

    const baseQuestion = loadQuestions().find((question) => question.id === questionId);
    if (!baseQuestion) {
      if (statusNode) {
        statusNode.textContent = '원본 질문을 찾지 못했습니다. 페이지를 새로고침해 주세요.';
        statusNode.dataset.state = 'error';
      }
      return;
    }

    try {
      if (statusNode) {
        statusNode.textContent = '답변을 저장하고 있습니다...';
        statusNode.dataset.state = 'loading';
      }
      if (submitButton) submitButton.disabled = true;

      const attachments = await prepareReplyAttachments(fileInput?.files || []);
      const draftReply = {
        id: crypto.randomUUID ? crypto.randomUUID() : `${questionId}-${Date.now()}`,
        questionId,
        content,
        createdAt: new Date().toISOString(),
        authorName: currentUser.name || 'Siemens User',
        authorEmail: currentUser.email || '',
        authorPicture: currentUser.picture || '',
        attachments
      };

      let replyResult;

      try {
        replyResult = await createReplyOnServer(draftReply);
      } catch (error) {
        if ((error?.message || '').includes('Target question was not found')) {
          const ensuredQuestion = await createQuestionOnServer(baseQuestion);
          upsertQuestionInStore(ensuredQuestion || baseQuestion);
          replyResult = await createReplyOnServer({
            ...draftReply,
            questionId: (ensuredQuestion && ensuredQuestion.id) || baseQuestion.id
          });
        } else {
          throw error;
        }
      }

      const { reply, question } = replyResult;

      if (question) {
        upsertQuestionInStore(question);
      } else {
        upsertQuestionInStore({
          ...baseQuestion,
          replies: mergeReplyLists(baseQuestion.replies || [], [reply]),
          replyCount: Number(baseQuestion.replyCount || 0) + 1
        });
      }

      refreshQuestionDrivenUI();
      if (statusNode) {
        statusNode.textContent = '답변이 등록되었습니다.';
        statusNode.dataset.state = 'success';
      }
      form.reset();
      updateReplyFileList(fileInput);
    } catch (error) {
      console.error(error);
      if (statusNode) {
        statusNode.textContent = error.message || '답변 등록 중 오류가 발생했습니다.';
        statusNode.dataset.state = 'error';
      }
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  };

  const handleQuestionEdit = (questionId) => {
    const question = findQuestionInStore(questionId);
    if (!question) {
      alert('수정할 질문을 찾지 못했습니다. 페이지를 새로고침해 주세요.');
      return;
    }

    if (!currentUser) {
      pendingProtectedAction = null;
      openAuthModal('질문 수정은 회원 전용입니다. 먼저 Google 로그인해 주세요.', 'default');
      return;
    }

    if (!canManagePost(question.authorEmail)) {
      alert('작성자 또는 관리자만 질문을 수정할 수 있습니다.');
      return;
    }

    openQuestionModal(question);
  };

  const handleQuestionDelete = async (questionId) => {
    const question = findQuestionInStore(questionId);
    if (!question) {
      alert('삭제할 질문을 찾지 못했습니다. 페이지를 새로고침해 주세요.');
      return;
    }

    if (!currentUser) {
      pendingProtectedAction = null;
      openAuthModal('질문 삭제는 회원 전용입니다. 먼저 Google 로그인해 주세요.', 'default');
      return;
    }

    if (!canManagePost(question.authorEmail)) {
      alert('작성자 또는 관리자만 질문을 삭제할 수 있습니다.');
      return;
    }

    const confirmed = window.confirm('이 질문과 연결된 답변까지 모두 삭제됩니다. 계속할까요?');
    if (!confirmed) return;

    try {
      if (APPS_SCRIPT_URL) {
        await deleteQuestionOnServer(questionId);
      }
      removeQuestionFromStore(questionId);
      refreshQuestionDrivenUI();
    } catch (error) {
      console.error(error);
      alert(error.message || '질문 삭제 중 오류가 발생했습니다.');
    }
  };

  const handleReplyEdit = async (questionId, replyId) => {
    const question = findQuestionInStore(questionId);
    const reply = question?.replies?.find((item) => String(item.id) === String(replyId));

    if (!question || !reply) {
      alert('수정할 답변을 찾지 못했습니다. 페이지를 새로고침해 주세요.');
      return;
    }

    if (!currentUser) {
      pendingProtectedAction = null;
      openAuthModal('답변 수정은 회원 전용입니다. 먼저 Google 로그인해 주세요.', 'default');
      return;
    }

    if (!canManagePost(reply.authorEmail)) {
      alert('작성자 또는 관리자만 답변을 수정할 수 있습니다.');
      return;
    }

    const nextContent = window.prompt('답변 내용을 수정해 주세요.', reply.content || '');
    if (nextContent === null) return;

    const trimmedContent = nextContent.trim();
    if (!trimmedContent) {
      alert('답변 내용을 입력해 주세요.');
      return;
    }

    try {
      const result = APPS_SCRIPT_URL
        ? await updateReplyOnServer(replyId, { questionId, content: trimmedContent })
        : { reply: { ...reply, content: trimmedContent }, question: null };

      if (result.question) {
        upsertQuestionInStore(result.question);
      } else {
        updateReplyInStore({ ...reply, content: trimmedContent });
      }

      refreshQuestionDrivenUI();
    } catch (error) {
      console.error(error);
      alert(error.message || '답변 수정 중 오류가 발생했습니다.');
    }
  };

  const handleReplyDelete = async (questionId, replyId) => {
    const question = findQuestionInStore(questionId);
    const reply = question?.replies?.find((item) => String(item.id) === String(replyId));

    if (!question || !reply) {
      alert('삭제할 답변을 찾지 못했습니다. 페이지를 새로고침해 주세요.');
      return;
    }

    if (!currentUser) {
      pendingProtectedAction = null;
      openAuthModal('답변 삭제는 회원 전용입니다. 먼저 Google 로그인해 주세요.', 'default');
      return;
    }

    if (!canManagePost(reply.authorEmail)) {
      alert('작성자 또는 관리자만 답변을 삭제할 수 있습니다.');
      return;
    }

    const confirmed = window.confirm('이 답변을 삭제할까요?');
    if (!confirmed) return;

    try {
      const result = APPS_SCRIPT_URL
        ? await deleteReplyOnServer(replyId, questionId)
        : { deletedReplyId: replyId, questionId, question: null };

      if (result.question) {
        upsertQuestionInStore(result.question);
      } else {
        removeReplyFromStore(questionId, replyId);
      }

      refreshQuestionDrivenUI();
    } catch (error) {
      console.error(error);
      alert(error.message || '답변 삭제 중 오류가 발생했습니다.');
    }
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

  const bindSearchInput = (input) => {
    input?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        executeSearch(input.value);
      }

      if (event.key === 'Escape' && input.value) {
        event.preventDefault();
        clearSearch({ scrollToResults: false });
      }
    });

    input?.addEventListener('input', () => {
      const value = input.value;
      if (input !== heroSearchInput && heroSearchInput && heroSearchInput.value !== value) {
        heroSearchInput.value = value;
      }
      if (input !== miniSearchInput && miniSearchInput && miniSearchInput.value !== value) {
        miniSearchInput.value = value;
      }
    });
  };

  bindSearchInput(heroSearchInput);
  bindSearchInput(miniSearchInput);

  heroSearchBtn?.addEventListener('click', () => executeSearch(heroSearchInput?.value || ''));

  document.querySelector('.clear-link')?.addEventListener('click', (event) => {
    event.preventDefault();
    clearSearch({ scrollToResults: false });
  });

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
  questionCategoryField?.addEventListener('change', updateQuestionResourceLinkVisibility);

  loginTrigger?.addEventListener('click', () => openAuthModal());
  logoutBtn?.addEventListener('click', handleLogout);
  authClose?.addEventListener('click', closeAuthModal);
  questionClose?.addEventListener('click', closeQuestionModal);
  questionCancel?.addEventListener('click', closeQuestionModal);
  askCommunityBtn?.addEventListener('click', handleAskClick);
  questionForm?.addEventListener('submit', handleQuestionSubmit);

  document.addEventListener('submit', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLFormElement) || !target.classList.contains('reply-form')) return;
    event.preventDefault();
    await handleReplySubmit(target);
  });

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const actionButton = target.closest('[data-action]');
    if (actionButton instanceof HTMLElement) {
      const { action, questionId = '', replyId = '' } = actionButton.dataset;

      if (action === 'edit-question') {
        handleQuestionEdit(questionId);
        return;
      }

      if (action === 'delete-question') {
        handleQuestionDelete(questionId);
        return;
      }

      if (action === 'edit-reply') {
        handleReplyEdit(questionId, replyId);
        return;
      }

      if (action === 'delete-reply') {
        handleReplyDelete(questionId, replyId);
        return;
      }
    }

    if (target.classList.contains('reply-login-btn')) {
      openAuthModal('답변 작성은 회원 전용입니다. 먼저 Google 로그인해 주세요.', 'default');
    }
  });

  document.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.classList.contains('reply-file-input')) return;
    updateReplyFileList(target);
  });

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
  initGoogleSignIn();
  bootstrapQuestionStore();
});