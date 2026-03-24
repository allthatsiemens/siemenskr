const SPREADSHEET_ID = '1pPMWuwnXklZK-urstNVi26GXuZ8tb2_0T1PpBPWowTo';
const USERS_SHEET_NAME = 'Users';
const QUESTIONS_SHEET_NAME = 'Questions';
const REPLIES_SHEET_NAME = 'Replies';
const UPLOAD_FOLDER_NAME = 'SiemensKR Forum Uploads';
const ADMIN_EMAILS = ['allthatsiemens@gmail.com'];
const MAX_REPLY_ATTACHMENTS = 3;
const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024;

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'health';

  if (action === 'listQuestions') {
    return jsonOutput({ ok: true, questions: listQuestions_(), spreadsheetUrl: spreadsheetUrl_() });
  }

  return jsonOutput({
    ok: true,
    message: 'SiemensKR forum web app is ready.',
    spreadsheetUrl: spreadsheetUrl_()
  });
}

function doPost(e) {
  try {
    const payload = parseBody_(e);
    const action = payload.action || 'auth';

    if (action === 'createQuestion') {
      const user = verifyGoogleIdToken_(payload.idToken);
      const question = normalizeQuestion_(payload.question, user);
      const savedQuestion = appendQuestionIfNeeded_(question);
      return jsonOutput({ ok: true, question: hydrateQuestion_(savedQuestion), spreadsheetUrl: spreadsheetUrl_() });
    }

    if (action === 'createReply') {
      const user = verifyGoogleIdToken_(payload.idToken);
      const reply = normalizeReply_(payload.reply, user);
      const savedReply = appendReplyIfNeeded_(reply);
      const question = getQuestionById_(savedReply.questionId);
      return jsonOutput({
        ok: true,
        reply: savedReply,
        question: question ? hydrateQuestion_(question) : null,
        spreadsheetUrl: spreadsheetUrl_()
      });
    }

    if (action === 'migrateQuestions') {
      const user = verifyGoogleIdToken_(payload.idToken);
      const questions = Array.isArray(payload.questions) ? payload.questions : [];
      questions.forEach(function (question) {
        appendQuestionIfNeeded_(normalizeQuestion_(question, user));
      });
      return jsonOutput({ ok: true, questions: listQuestions_(), spreadsheetUrl: spreadsheetUrl_() });
    }

    if (action === 'updateQuestion') {
      const user = verifyGoogleIdToken_(payload.idToken);
      const updatedQuestion = updateQuestion_(payload.questionId, payload.question || {}, user);
      return jsonOutput({ ok: true, question: hydrateQuestion_(updatedQuestion), spreadsheetUrl: spreadsheetUrl_() });
    }

    if (action === 'deleteQuestion') {
      const user = verifyGoogleIdToken_(payload.idToken);
      const deletedQuestionId = deleteQuestion_(payload.questionId, user);
      return jsonOutput({ ok: true, deletedQuestionId: deletedQuestionId, spreadsheetUrl: spreadsheetUrl_() });
    }

    if (action === 'updateReply') {
      const user = verifyGoogleIdToken_(payload.idToken);
      const updatedReply = updateReply_(payload.replyId, payload.reply || {}, user);
      const updatedQuestion = getQuestionById_(updatedReply.questionId);
      return jsonOutput({
        ok: true,
        reply: updatedReply,
        question: updatedQuestion ? hydrateQuestion_(updatedQuestion) : null,
        spreadsheetUrl: spreadsheetUrl_()
      });
    }

    if (action === 'deleteReply') {
      const user = verifyGoogleIdToken_(payload.idToken);
      const deletion = deleteReply_(payload.replyId, payload.questionId, user);
      const updatedQuestion = getQuestionById_(deletion.questionId);
      return jsonOutput({
        ok: true,
        deletedReplyId: deletion.replyId,
        questionId: deletion.questionId,
        question: updatedQuestion ? hydrateQuestion_(updatedQuestion) : null,
        spreadsheetUrl: spreadsheetUrl_()
      });
    }

    const user = verifyGoogleIdToken_(payload.idToken);
    const mode = upsertUser_(user);

    return jsonOutput({
      ok: true,
      mode: mode,
      user: {
        name: user.name || '',
        email: user.email || '',
        picture: user.picture || ''
      },
      spreadsheetUrl: spreadsheetUrl_()
    });
  } catch (error) {
    return jsonOutput({ ok: false, error: error.message || 'Unknown error' });
  }
}

function parseBody_(e) {
  const raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
  return JSON.parse(raw);
}

function jsonOutput(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function spreadsheet_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function spreadsheetUrl_() {
  return spreadsheet_().getUrl();
}

function getSheet_(sheetName, headers) {
  const ss = spreadsheet_();
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }

  const firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const missingHeaders = headers.some(function (header, index) {
    return firstRow[index] !== header;
  });

  if (missingHeaders) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function usersSheet_() {
  return getSheet_(USERS_SHEET_NAME, ['email', 'name', 'picture', 'createdAt', 'lastLoginAt']);
}

function questionsSheet_() {
  return getSheet_(QUESTIONS_SHEET_NAME, ['id', 'category', 'title', 'content', 'createdAt', 'authorName', 'authorEmail', 'authorPicture', 'replyCount', 'fingerprint']);
}

function repliesSheet_() {
  return getSheet_(REPLIES_SHEET_NAME, ['id', 'questionId', 'content', 'createdAt', 'authorName', 'authorEmail', 'authorPicture', 'attachmentJson', 'fingerprint']);
}

function verifyGoogleIdToken_(idToken) {
  if (!idToken) {
    throw new Error('idToken is required');
  }

  const response = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken), {
    muteHttpExceptions: true
  });
  const statusCode = response.getResponseCode();
  const data = JSON.parse(response.getContentText() || '{}');

  if (statusCode !== 200 || !data.email) {
    throw new Error(data.error_description || data.error || 'Google token verification failed');
  }

  return {
    email: data.email,
    name: data.name || data.email,
    picture: data.picture || ''
  };
}

function upsertUser_(user) {
  const sheet = usersSheet_();
  const values = sheet.getDataRange().getValues();
  const now = new Date().toISOString();

  for (var rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    if (String(values[rowIndex][0]).toLowerCase() === String(user.email).toLowerCase()) {
      sheet.getRange(rowIndex + 1, 1, 1, 5).setValues([[user.email, user.name || '', user.picture || '', values[rowIndex][3] || now, now]]);
      return 'login';
    }
  }

  sheet.appendRow([user.email, user.name || '', user.picture || '', now, now]);
  return 'signup';
}

function normalizeQuestion_(question, user) {
  if (!question || !question.category || !question.title || !question.content) {
    throw new Error('category, title and content are required');
  }

  const normalized = {
    id: String(question.id || Utilities.getUuid()),
    category: String(question.category),
    title: String(question.title),
    content: String(question.content),
    createdAt: question.createdAt || new Date().toISOString(),
    authorName: question.authorName || user.name || 'Siemens User',
    authorEmail: question.authorEmail || user.email || '',
    authorPicture: question.authorPicture || user.picture || '',
    replyCount: Number(question.replyCount || 0)
  };

  normalized.fingerprint = [
    normalized.id,
    normalized.category,
    normalized.title,
    normalized.content,
    normalized.authorEmail,
    normalized.createdAt
  ].join('||');

  return normalized;
}

function normalizeReply_(reply, user) {
  if (!reply || !reply.questionId || !reply.content) {
    throw new Error('questionId and content are required');
  }

  const question = getQuestionById_(reply.questionId);
  if (!question) {
    throw new Error('Target question was not found');
  }

  const attachments = storeReplyAttachments_(reply.attachments || [], question.id, user);
  const normalized = {
    id: String(reply.id || Utilities.getUuid()),
    questionId: String(reply.questionId),
    content: String(reply.content),
    createdAt: reply.createdAt || new Date().toISOString(),
    authorName: reply.authorName || user.name || 'Siemens User',
    authorEmail: reply.authorEmail || user.email || '',
    authorPicture: reply.authorPicture || user.picture || '',
    attachments: attachments
  };

  normalized.fingerprint = [
    normalized.id,
    normalized.questionId,
    normalized.content,
    normalized.authorEmail,
    normalized.createdAt
  ].join('||');

  return normalized;
}

function appendQuestionIfNeeded_(question) {
  const sheet = questionsSheet_();
  const values = sheet.getDataRange().getValues();

  for (var rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    if (String(values[rowIndex][9]) === question.fingerprint) {
      return mapQuestionRow_(values[rowIndex]);
    }
  }

  sheet.appendRow([
    question.id,
    question.category,
    question.title,
    question.content,
    question.createdAt,
    question.authorName,
    question.authorEmail,
    question.authorPicture,
    question.replyCount,
    question.fingerprint
  ]);

  return question;
}

function appendReplyIfNeeded_(reply) {
  const sheet = repliesSheet_();
  const values = sheet.getDataRange().getValues();

  for (var rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    if (String(values[rowIndex][8]) === reply.fingerprint) {
      return mapReplyRow_(values[rowIndex]);
    }
  }

  sheet.appendRow([
    reply.id,
    reply.questionId,
    reply.content,
    reply.createdAt,
    reply.authorName,
    reply.authorEmail,
    reply.authorPicture,
    JSON.stringify(reply.attachments || []),
    reply.fingerprint
  ]);

  updateQuestionReplyCount_(reply.questionId);
  return reply;
}

function findQuestionRowIndexById_(questionId) {
  const sheet = questionsSheet_();
  const values = sheet.getDataRange().getValues();

  for (var rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    if (String(values[rowIndex][0]) === String(questionId)) {
      return {
        sheet: sheet,
        rowIndex: rowIndex + 1,
        row: values[rowIndex]
      };
    }
  }

  return null;
}

function findReplyRowIndexById_(replyId) {
  const sheet = repliesSheet_();
  const values = sheet.getDataRange().getValues();

  for (var rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    if (String(values[rowIndex][0]) === String(replyId)) {
      return {
        sheet: sheet,
        rowIndex: rowIndex + 1,
        row: values[rowIndex]
      };
    }
  }

  return null;
}

function normalizeEmail_(email) {
  return String(email || '').trim().toLowerCase();
}

function isAdminEmail_(email) {
  return ADMIN_EMAILS.indexOf(normalizeEmail_(email)) !== -1;
}

function assertRecordOwner_(user, ownerEmail, label) {
  if (isAdminEmail_(user && user.email)) {
    return;
  }

  if (normalizeEmail_(user && user.email) !== normalizeEmail_(ownerEmail)) {
    throw new Error(label + ' 작성자 또는 관리자만 수정 또는 삭제할 수 있습니다.');
  }
}

function deleteAttachmentsFromDrive_(attachments) {
  const items = Array.isArray(attachments) ? attachments : [];

  items.forEach(function (attachment) {
    const fileId = attachment && attachment.fileId ? String(attachment.fileId) : '';
    if (!fileId) return;

    try {
      DriveApp.getFileById(fileId).setTrashed(true);
    } catch (error) {
      // Ignore cleanup failures to keep delete flows resilient.
    }
  });
}

function updateQuestion_(questionId, question, user) {
  const match = findQuestionRowIndexById_(questionId);
  if (!match) {
    throw new Error('Target question was not found');
  }

  const existing = mapQuestionRow_(match.row);
  assertRecordOwner_(user, existing.authorEmail, '질문');

  const category = String(question && question.category ? question.category : existing.category).trim();
  const title = String(question && question.title ? question.title : existing.title).trim();
  const content = String(question && question.content ? question.content : existing.content).trim();

  if (!category || !title || !content) {
    throw new Error('category, title and content are required');
  }

  const updated = {
    id: existing.id,
    category: category,
    title: title,
    content: content,
    createdAt: existing.createdAt,
    authorName: existing.authorName || user.name || 'Siemens User',
    authorEmail: existing.authorEmail || user.email || '',
    authorPicture: existing.authorPicture || user.picture || '',
    replyCount: Number(existing.replyCount || 0)
  };

  const fingerprint = [
    updated.id,
    updated.category,
    updated.title,
    updated.content,
    updated.authorEmail,
    updated.createdAt
  ].join('||');

  match.sheet.getRange(match.rowIndex, 1, 1, 10).setValues([[
    updated.id,
    updated.category,
    updated.title,
    updated.content,
    updated.createdAt,
    updated.authorName,
    updated.authorEmail,
    updated.authorPicture,
    updated.replyCount,
    fingerprint
  ]]);

  return updated;
}

function deleteQuestion_(questionId, user) {
  const match = findQuestionRowIndexById_(questionId);
  if (!match) {
    throw new Error('Target question was not found');
  }

  const existing = mapQuestionRow_(match.row);
  assertRecordOwner_(user, existing.authorEmail, '질문');

  const replySheet = repliesSheet_();
  const replyValues = replySheet.getDataRange().getValues();

  for (var replyIndex = replyValues.length - 1; replyIndex >= 1; replyIndex -= 1) {
    if (String(replyValues[replyIndex][1]) === String(existing.id)) {
      deleteAttachmentsFromDrive_(mapReplyRow_(replyValues[replyIndex]).attachments || []);
      replySheet.deleteRow(replyIndex + 1);
    }
  }

  match.sheet.deleteRow(match.rowIndex);
  return existing.id;
}

function updateReply_(replyId, reply, user) {
  const match = findReplyRowIndexById_(replyId);
  if (!match) {
    throw new Error('Target reply was not found');
  }

  const existing = mapReplyRow_(match.row);
  assertRecordOwner_(user, existing.authorEmail, '답변');

  const content = String(reply && reply.content ? reply.content : '').trim();
  if (!content) {
    throw new Error('questionId and content are required');
  }

  const updated = {
    id: existing.id,
    questionId: existing.questionId,
    content: content,
    createdAt: existing.createdAt,
    authorName: existing.authorName || user.name || 'Siemens User',
    authorEmail: existing.authorEmail || user.email || '',
    authorPicture: existing.authorPicture || user.picture || '',
    attachments: existing.attachments || []
  };

  const fingerprint = [
    updated.id,
    updated.questionId,
    updated.content,
    updated.authorEmail,
    updated.createdAt
  ].join('||');

  match.sheet.getRange(match.rowIndex, 1, 1, 9).setValues([[
    updated.id,
    updated.questionId,
    updated.content,
    updated.createdAt,
    updated.authorName,
    updated.authorEmail,
    updated.authorPicture,
    JSON.stringify(updated.attachments || []),
    fingerprint
  ]]);

  updateQuestionReplyCount_(updated.questionId);
  return updated;
}

function deleteReply_(replyId, questionId, user) {
  const match = findReplyRowIndexById_(replyId);
  if (!match) {
    throw new Error('Target reply was not found');
  }

  const existing = mapReplyRow_(match.row);
  if (questionId && String(existing.questionId) !== String(questionId)) {
    throw new Error('Reply does not belong to the specified question');
  }

  assertRecordOwner_(user, existing.authorEmail, '답변');
  deleteAttachmentsFromDrive_(existing.attachments || []);
  match.sheet.deleteRow(match.rowIndex);
  updateQuestionReplyCount_(existing.questionId);

  return {
    replyId: existing.id,
    questionId: existing.questionId
  };
}

function listQuestions_() {
  const questions = listQuestionRows_();
  const repliesByQuestionId = repliesByQuestionId_();

  return questions
    .map(function (question) {
      return hydrateQuestion_(question, repliesByQuestionId[question.id] || []);
    })
    .sort(function (a, b) {
      return new Date(lastActivityAt_(b)).getTime() - new Date(lastActivityAt_(a)).getTime();
    });
}

function listQuestionRows_() {
  const sheet = questionsSheet_();
  const values = sheet.getDataRange().getValues();

  if (values.length <= 1) {
    return [];
  }

  return values
    .slice(1)
    .filter(function (row) {
      return row[1] && row[2] && row[3];
    })
    .map(mapQuestionRow_);
}

function listReplyRows_() {
  const sheet = repliesSheet_();
  const values = sheet.getDataRange().getValues();

  if (values.length <= 1) {
    return [];
  }

  return values
    .slice(1)
    .filter(function (row) {
      return row[1] && row[2];
    })
    .map(mapReplyRow_)
    .sort(function (a, b) {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
}

function repliesByQuestionId_() {
  return listReplyRows_().reduce(function (accumulator, reply) {
    if (!accumulator[reply.questionId]) {
      accumulator[reply.questionId] = [];
    }
    accumulator[reply.questionId].push(reply);
    return accumulator;
  }, {});
}

function hydrateQuestion_(question, replies) {
  const safeReplies = Array.isArray(replies) ? replies : (repliesByQuestionId_()[question.id] || []);
  return {
    id: question.id,
    category: question.category,
    title: question.title,
    content: question.content,
    createdAt: question.createdAt,
    authorName: question.authorName,
    authorEmail: question.authorEmail,
    authorPicture: question.authorPicture,
    replyCount: Math.max(Number(question.replyCount || 0), safeReplies.length),
    replies: safeReplies
  };
}

function getQuestionById_(questionId) {
  const questions = listQuestionRows_();
  for (var index = 0; index < questions.length; index += 1) {
    if (String(questions[index].id) === String(questionId)) {
      return questions[index];
    }
  }
  return null;
}

function updateQuestionReplyCount_(questionId) {
  const sheet = questionsSheet_();
  const values = sheet.getDataRange().getValues();
  const replyCount = (repliesByQuestionId_()[questionId] || []).length;

  for (var rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    if (String(values[rowIndex][0]) === String(questionId)) {
      sheet.getRange(rowIndex + 1, 9).setValue(replyCount);
      return replyCount;
    }
  }

  return replyCount;
}

function lastActivityAt_(question) {
  const replies = Array.isArray(question.replies) ? question.replies : [];
  return replies.length ? replies[replies.length - 1].createdAt : question.createdAt;
}

function storeReplyAttachments_(attachments, questionId, user) {
  const items = Array.isArray(attachments) ? attachments : [];

  if (!items.length) return [];
  if (items.length > MAX_REPLY_ATTACHMENTS) {
    throw new Error('Too many file attachments');
  }

  const folder = uploadFolder_();
  return items.map(function (attachment, index) {
    return uploadAttachmentToDrive_(attachment, folder, questionId, user, index);
  });
}

function uploadFolder_() {
  const folders = DriveApp.getFoldersByName(UPLOAD_FOLDER_NAME);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(UPLOAD_FOLDER_NAME);
}

function uploadAttachmentToDrive_(attachment, folder, questionId, user, index) {
  const dataUrl = attachment && attachment.dataUrl ? String(attachment.dataUrl) : '';
  const providedType = attachment && attachment.contentType ? String(attachment.contentType) : '';
  const providedName = attachment && attachment.name ? String(attachment.name) : ('reply-file-' + (index + 1));

  if (!dataUrl || dataUrl.indexOf('data:') !== 0 || dataUrl.indexOf('base64,') === -1) {
    throw new Error('Invalid attachment payload');
  }

  const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) {
    throw new Error('Unsupported attachment format');
  }

  const mimeType = normalizeAttachmentMimeType_(providedType || matches[1] || 'application/octet-stream', providedName);
  if (!isAllowedAttachmentMimeType_(mimeType)) {
    throw new Error('Only image and PDF files can be uploaded');
  }

  const bytes = Utilities.base64Decode(matches[2]);
  if (bytes.length > MAX_ATTACHMENT_SIZE_BYTES) {
    throw new Error('Attachment exceeds maximum upload size');
  }

  const safeName = sanitizeFileName_(providedName);
  const extension = extensionFromMimeType_(mimeType, providedName);
  const fileName = [questionId, new Date().getTime(), index + 1, safeName].join('_') + extension;
  const blob = Utilities.newBlob(bytes, mimeType, fileName);
  const file = folder.createFile(blob);
  const webViewUrl = 'https://drive.google.com/file/d/' + file.getId() + '/view';
  const previewUrl = mimeType.indexOf('image/') === 0
    ? 'https://drive.google.com/uc?export=view&id=' + file.getId()
    : '';

  file.setDescription('SiemensKR forum reply attachment uploaded by ' + (user.email || 'unknown user'));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return {
    name: safeName + extension,
    url: webViewUrl,
    previewUrl: previewUrl,
    contentType: mimeType,
    fileId: file.getId()
  };
}

function sanitizeFileName_(fileName) {
  return String(fileName || 'image')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9가-힣._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'image';
}

function isAllowedAttachmentMimeType_(mimeType) {
  const value = String(mimeType || '').toLowerCase();
  return value.indexOf('image/') === 0 || value === 'application/pdf';
}

function normalizeAttachmentMimeType_(mimeType, fileName) {
  const value = String(mimeType || '').toLowerCase();
  if (value && value !== 'application/octet-stream') {
    return value;
  }

  return /\.pdf$/i.test(String(fileName || '')) ? 'application/pdf' : value;
}

function extensionFromMimeType_(mimeType, fileName) {
  const map = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/bmp': '.bmp',
    'application/pdf': '.pdf'
  };
  const normalizedType = String(mimeType || '').toLowerCase();
  return map[normalizedType] || (/\.pdf$/i.test(String(fileName || '')) ? '.pdf' : '');
}

function mapQuestionRow_(row) {
  return {
    id: row[0],
    category: row[1],
    title: row[2],
    content: row[3],
    createdAt: row[4],
    authorName: row[5],
    authorEmail: row[6],
    authorPicture: row[7],
    replyCount: Number(row[8] || 0)
  };
}

function mapReplyRow_(row) {
  let attachments = [];
  try {
    attachments = row[7] ? JSON.parse(row[7]) : [];
  } catch (error) {
    attachments = [];
  }

  return {
    id: row[0],
    questionId: row[1],
    content: row[2],
    createdAt: row[3],
    authorName: row[4],
    authorEmail: row[5],
    authorPicture: row[6],
    attachments: Array.isArray(attachments) ? attachments : []
  };
}
