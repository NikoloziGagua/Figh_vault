(() => {
  'use strict';

  const APP_VERSION = 4;
  const DB_NAME = 'fight-vault';
  const DB_VERSION = 1;
  const STORE_NAME = 'app';
  const STATE_KEY = 'state-v3';
  const DAY = 86_400_000;
  const ROUTES = ['today', 'vault', 'train', 'progress'];
  const CATEGORIES = ['Punches', 'Kicks', 'Knees', 'Elbows', 'Defence', 'Footwork', 'Counters', 'Clinch', 'Other'];
  const CATEGORY_CODES = {
    Punches: 'BOX', Kicks: 'KCK', Knees: 'KNE', Elbows: 'ELB', Defence: 'DEF',
    Footwork: 'FTW', Counters: 'CTR', Clinch: 'CLN', Other: 'MOV'
  };
  const CATEGORY_TINTS = {
    Punches: 'rgba(255,91,71,.13)', Kicks: 'rgba(248,173,73,.13)', Knees: 'rgba(255,126,81,.13)',
    Elbows: 'rgba(238,92,111,.13)', Defence: 'rgba(101,169,255,.13)', Footwork: 'rgba(94,213,155,.12)',
    Counters: 'rgba(179,124,255,.12)', Clinch: 'rgba(90,203,194,.12)', Other: 'rgba(255,255,255,.08)'
  };
  const INSIGHT_TYPES = ['Principle', 'Coaching cue', 'Common mistake', 'Drill', 'Combination idea', 'Review question'];

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const clean = (value, max = 1000) => String(value ?? '').trim().slice(0, max);
  const lines = (value) => String(value ?? '').split(/\r?\n/).map((item) => clean(item, 240)).filter(Boolean).slice(0, 30);
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);
  const uid = (prefix = 'id') => `${prefix}_${globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(16).slice(2)}`}`;
  const clamp = (number, minimum, maximum) => Math.min(maximum, Math.max(minimum, Number(number) || 0));
  const nowIso = () => new Date().toISOString();
  const toIso = (value, fallback = Date.now()) => {
    if (typeof value === 'string') {
      const legacyDate = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (legacyDate) {
        const parsedLegacy = new Date(Number(legacyDate[3]), Number(legacyDate[2]) - 1, Number(legacyDate[1]));
        if (Number.isFinite(parsedLegacy.getTime())) return parsedLegacy.toISOString();
      }
    }
    const parsed = new Date(value ?? fallback);
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : new Date(fallback).toISOString();
  };
  const addDays = (date, days) => new Date(new Date(date).getTime() + (days * DAY)).toISOString();
  const startOfDay = (date = new Date()) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dateValue = (value) => {
    const time = new Date(value || 0).getTime();
    return Number.isFinite(time) ? time : 0;
  };
  const isDue = (technique) => dateValue(technique.schedule?.dueAt) <= Date.now();
  const safeUrl = (value) => {
    try {
      const url = new URL(clean(value, 1000));
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch (_) {
      return '';
    }
  };
  const formatDuration = (seconds) => {
    const safeSeconds = Math.max(0, Math.round(Number(seconds) || 0));
    const minutes = Math.floor(safeSeconds / 60);
    const remainder = safeSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
  };
  const formatTimestamp = (seconds) => {
    if (!Number.isFinite(Number(seconds))) return 'Text';
    const value = Math.max(0, Math.floor(Number(seconds)));
    const hours = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    const remainder = value % 60;
    return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}` : `${minutes}:${String(remainder).padStart(2, '0')}`;
  };
  const formatMinutes = (seconds) => {
    const minutes = Math.max(0, Math.round((Number(seconds) || 0) / 60));
    return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  };
  const formatDate = (value, options = { day: 'numeric', month: 'short' }) => new Intl.DateTimeFormat(undefined, options).format(new Date(value));
  const formatRelativeDue = (value) => {
    const difference = startOfDay(new Date(value)).getTime() - startOfDay().getTime();
    const days = Math.round(difference / DAY);
    if (days < 0) return `${Math.abs(days)}d overdue`;
    if (days === 0) return 'Due today';
    if (days === 1) return 'Due tomorrow';
    return `Due in ${days}d`;
  };
  const categoryCode = (category) => CATEGORY_CODES[category] || 'MOV';
  const categoryTint = (category) => CATEGORY_TINTS[category] || CATEGORY_TINTS.Other;
  const techniqueName = (id) => state.techniques.find((item) => item.id === id)?.name || 'Unknown technique';
  const comboStepName = (step) => state.techniques.find((item) => item.id === step.techniqueId)?.name || step.label || 'Unknown movement';
  const comboSpokenName = (combo) => combo.steps.map(comboStepName).join(', ');
  const sourceName = (id) => state.sources.find((item) => item.id === id)?.title || 'Unknown source';
  const getTechniqueInsights = (id) => state.insights.filter((item) => item.status === 'connected' && item.techniqueId === id);
  const parseTimestamp = (value) => {
    const parts = String(value || '').trim().replace(',', '.').split(':').map(Number);
    if (!parts.length || parts.some((part) => !Number.isFinite(part))) return null;
    if (parts.length === 3) return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
    if (parts.length === 2) return (parts[0] * 60) + parts[1];
    return parts[0];
  };
  const youtubeVideoId = (value) => {
    try {
      const url = new URL(clean(value, 1000));
      const host = url.hostname.replace(/^www\./, '').toLowerCase();
      if (host === 'youtu.be') return clean(url.pathname.split('/').filter(Boolean)[0], 20);
      if (!['youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(host)) return '';
      if (url.searchParams.get('v')) return clean(url.searchParams.get('v'), 20);
      const parts = url.pathname.split('/').filter(Boolean);
      if (['shorts', 'embed', 'live'].includes(parts[0])) return clean(parts[1], 20);
      return '';
    } catch (_) {
      return '';
    }
  };
  const youtubeAt = (source, seconds = null) => {
    try {
      const url = new URL(source.url);
      if (Number.isFinite(Number(seconds))) url.searchParams.set('t', `${Math.max(0, Math.floor(Number(seconds)))}s`);
      return url.href;
    } catch (_) {
      return source.url;
    }
  };

  const stripCaptionMarkup = (value) => clean(String(value || '')
    .replace(/<\/?(?:c|v|lang)(?:\.[^ >]+)?[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' '), 2000);

  const splitUntimedText = (text) => {
    const paragraphs = String(text || '').split(/\n\s*\n/).map((item) => stripCaptionMarkup(item)).filter(Boolean);
    const chunks = [];
    paragraphs.forEach((paragraph) => {
      if (paragraph.length <= 520) {
        chunks.push(paragraph);
        return;
      }
      const sentences = paragraph.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [paragraph];
      let current = '';
      sentences.forEach((sentence) => {
        if (`${current} ${sentence}`.trim().length > 520 && current) {
          chunks.push(current.trim());
          current = sentence;
        } else current = `${current} ${sentence}`;
      });
      if (current.trim()) chunks.push(current.trim());
    });
    return chunks.slice(0, 5000).map((item) => ({ id: uid('segment'), startSec: null, endSec: null, text: item }));
  };

  const parseTranscript = (raw) => {
    const transcript = String(raw || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').slice(0, 1_500_000);
    const inputLines = transcript.split('\n');
    const segments = [];
    let current = null;
    const flush = () => {
      if (!current) return;
      const text = stripCaptionMarkup(current.text.join(' '));
      if (text) segments.push({ id: uid('segment'), startSec: current.startSec, endSec: current.endSec, text });
      current = null;
    };
    const timePattern = '((?:\\d{1,2}:)?\\d{1,2}:\\d{2}(?:[.,]\\d{1,3})?)';
    const arrowPattern = new RegExp(`^${timePattern}\\s*-->\\s*${timePattern}`);
    const inlinePattern = new RegExp(`^\\[?${timePattern}\\]?\\s*(?:[-–—]\\s*)?(.*)$`);
    inputLines.forEach((rawLine) => {
      const line = rawLine.trim();
      if (!line) {
        if (current?.text.length) flush();
        return;
      }
      if (/^(WEBVTT|NOTE\b|STYLE\b|REGION\b|Kind:|Language:)/i.test(line)) return;
      const arrow = line.match(arrowPattern);
      if (arrow) {
        flush();
        current = { startSec: parseTimestamp(arrow[1]), endSec: parseTimestamp(arrow[2]), text: [] };
        return;
      }
      const inline = line.match(inlinePattern);
      if (inline) {
        flush();
        current = { startSec: parseTimestamp(inline[1]), endSec: null, text: [] };
        if (inline[2]) current.text.push(inline[2]);
        return;
      }
      if (/^\d+$/.test(line) && !current?.text.length) return;
      current ||= { startSec: null, endSec: null, text: [] };
      current.text.push(line);
    });
    flush();
    const timestamped = segments.some((segment) => segment.startSec !== null);
    if (!segments.length || !timestamped) return splitUntimedText(transcript);
    const unique = [];
    const seen = new Set();
    segments.forEach((segment, index) => {
      if (segment.endSec === null && segments[index + 1] && segments[index + 1].startSec !== null) segment.endSec = segments[index + 1].startSec;
      const key = `${segment.startSec}:${segment.text}`;
      if (!seen.has(key)) { seen.add(key); unique.push(segment); }
    });
    return unique.slice(0, 10_000);
  };
  const getWeekStart = (offset = 0) => {
    const date = startOfDay();
    const day = (date.getDay() + 6) % 7;
    date.setDate(date.getDate() - day + (offset * 7));
    return date;
  };
  const withinCurrentWeek = (value) => dateValue(value) >= getWeekStart().getTime();
  const durationForSession = (session) => Number(session.durationSec) || 0;

  const blankState = () => ({
    version: APP_VERSION,
    profile: {
      onboardingComplete: false,
      name: '',
      discipline: 'Kickboxing',
      stance: 'Orthodox',
      goal: 'retain',
      createdAt: nowIso()
    },
    preferences: {
      focusTechniqueId: null,
      training: {
        mode: 'smart', category: 'Kicks', rounds: 3, roundLength: 120, restLength: 30,
        promptInterval: 8, voiceEnabled: true, cueEnabled: true, combosEnabled: true
      }
    },
    techniques: [],
    combos: [],
    sessions: [],
    reviewLog: [],
    sources: [],
    insights: []
  });

  const normalizeSchedule = (schedule = {}, legacyReview = 0) => ({
    dueAt: toIso(schedule.dueAt || Date.now() - (Number(legacyReview) || 0) * 1000),
    intervalDays: clamp(schedule.intervalDays || 0, 0, 3650),
    ease: clamp(schedule.ease || 2.3, 1.3, 3.2),
    reps: clamp(schedule.reps || 0, 0, 100000),
    lapses: clamp(schedule.lapses || 0, 0, 100000),
    lastReviewedAt: schedule.lastReviewedAt ? toIso(schedule.lastReviewedAt) : null
  });

  const normalizeTechnique = (raw = {}) => {
    const createdAt = raw.createdAt || nowIso();
    return {
      id: clean(raw.id || uid('tech'), 120),
      name: clean(raw.name || 'Untitled technique', 80),
      category: CATEGORIES.includes(raw.category) ? raw.category : 'Other',
      stance: ['Both', 'Orthodox', 'Southpaw'].includes(raw.stance) ? raw.stance : 'Both',
      confidence: clamp(raw.confidence || 1, 1, 5),
      cue: clean(raw.cue || raw.notes || '', 300),
      steps: Array.isArray(raw.steps) ? raw.steps.map((item) => clean(item, 240)).filter(Boolean).slice(0, 30) : lines(raw.steps),
      keys: Array.isArray(raw.keys) ? raw.keys.map((item) => clean(item, 240)).filter(Boolean).slice(0, 30) : lines(raw.keys),
      mistakes: Array.isArray(raw.mistakes) ? raw.mistakes.map((item) => clean(item, 240)).filter(Boolean).slice(0, 30) : lines(raw.mistakes),
      notes: clean(raw.notes || '', 2000),
      mediaUrl: safeUrl(raw.mediaUrl || ''),
      createdAt: toIso(createdAt),
      updatedAt: toIso(raw.updatedAt || createdAt),
      lastTrainedAt: raw.lastTrainedAt ? toIso(raw.lastTrainedAt) : null,
      trainingCount: clamp(raw.trainingCount || 0, 0, 100000),
      schedule: normalizeSchedule(raw.schedule, raw.review)
    };
  };

  const normalizeCombo = (raw = {}, techniques = []) => {
    let rawSteps = Array.isArray(raw.steps) ? raw.steps : [];
    if (!rawSteps.length && Array.isArray(raw.sequence)) {
      rawSteps = raw.sequence.map((label) => {
        const match = techniques.find((technique) => technique.name.toLowerCase() === clean(label).toLowerCase());
        return { techniqueId: match?.id || null, label: clean(label, 80) };
      });
    }
    return {
      id: clean(raw.id || uid('combo'), 120),
      name: clean(raw.name || 'Untitled combination', 80),
      purpose: clean(raw.purpose || '', 180),
      steps: rawSteps.map((step) => ({
        techniqueId: step.techniqueId && techniques.some((technique) => technique.id === String(step.techniqueId)) ? String(step.techniqueId) : null,
        label: clean(step.label || techniques.find((technique) => technique.id === String(step.techniqueId))?.name || '', 80)
      })).filter((step) => step.techniqueId || step.label).slice(0, 20),
      createdAt: toIso(raw.createdAt || nowIso()),
      updatedAt: toIso(raw.updatedAt || raw.createdAt || nowIso()),
      lastTrainedAt: raw.lastTrainedAt ? toIso(raw.lastTrainedAt) : null,
      trainingCount: clamp(raw.trainingCount || 0, 0, 100000)
    };
  };

  const normalizeSession = (raw = {}) => ({
    id: clean(raw.id || uid('session'), 120),
    source: raw.source === 'external' ? 'external' : 'fight-vault',
    mode: clean(raw.mode || 'Smart session', 80),
    startedAt: toIso(raw.startedAt || raw.completedAt || raw.date || nowIso()),
    completedAt: toIso(raw.completedAt || raw.startedAt || raw.date || nowIso()),
    durationSec: clamp(raw.durationSec || (Number(raw.duration) * 60) || 0, 0, 86_400),
    rounds: clamp(raw.rounds || 0, 0, 100),
    techniqueIds: Array.isArray(raw.techniqueIds) ? raw.techniqueIds.map(String).slice(0, 200) : [],
    comboIds: Array.isArray(raw.comboIds) ? raw.comboIds.map(String).slice(0, 200) : [],
    prompts: Array.isArray(raw.prompts) ? raw.prompts.map((item) => ({ type: item.type === 'combo' ? 'combo' : 'technique', id: clean(item.id, 120), at: item.at || nowIso() })).slice(0, 1000) : [],
    focus: clean(raw.focus || '', 180),
    feeling: ['hard', 'good', 'sharp'].includes(raw.feeling) ? raw.feeling : 'good',
    reflection: {
      win: clean(raw.reflection?.win || raw.wins || '', 400),
      improve: clean(raw.reflection?.improve || raw.improve || '', 400)
    }
  });

  const normalizeSource = (raw = {}) => {
    const transcriptText = String(raw.transcriptText || raw.transcript || '').slice(0, 1_500_000);
    const suppliedSegments = Array.isArray(raw.segments) ? raw.segments : parseTranscript(transcriptText);
    const url = safeUrl(raw.url || '');
    return {
      id: clean(raw.id || uid('source'), 120),
      provider: 'youtube',
      url,
      videoId: clean(raw.videoId || youtubeVideoId(url), 20),
      title: clean(raw.title || 'Untitled film source', 180),
      creator: clean(raw.creator || '', 100),
      topic: clean(raw.topic || '', 100),
      transcriptText,
      segments: suppliedSegments.map((segment) => ({
        id: clean(segment.id || uid('segment'), 120),
        startSec: segment.startSec !== null && segment.startSec !== '' && Number.isFinite(Number(segment.startSec)) ? Math.max(0, Number(segment.startSec)) : null,
        endSec: segment.endSec !== null && segment.endSec !== '' && Number.isFinite(Number(segment.endSec)) ? Math.max(0, Number(segment.endSec)) : null,
        text: clean(segment.text, 2000)
      })).filter((segment) => segment.text).slice(0, 10_000),
      createdAt: toIso(raw.createdAt || nowIso()),
      updatedAt: toIso(raw.updatedAt || raw.createdAt || nowIso())
    };
  };

  const normalizeInsight = (raw = {}, sourceIds = new Set(), techniqueIds = new Set()) => ({
    id: clean(raw.id || uid('insight'), 120),
    sourceId: sourceIds.has(String(raw.sourceId)) ? String(raw.sourceId) : null,
    segmentId: raw.segmentId ? clean(raw.segmentId, 120) : null,
    type: INSIGHT_TYPES.includes(raw.type) ? raw.type : 'Principle',
    title: clean(raw.title || 'Untitled insight', 100),
    body: clean(raw.body || '', 800),
    timestampSec: raw.timestampSec !== null && raw.timestampSec !== '' && Number.isFinite(Number(raw.timestampSec)) ? Math.max(0, Number(raw.timestampSec)) : null,
    status: ['inbox', 'connected', 'dismissed'].includes(raw.status) ? raw.status : 'inbox',
    techniqueId: techniqueIds.has(String(raw.techniqueId)) ? String(raw.techniqueId) : null,
    connectionType: ['coaching-point', 'primary-cue', 'notes', 'keep', 'new-technique'].includes(raw.connectionType) ? raw.connectionType : null,
    createdAt: toIso(raw.createdAt || nowIso()),
    updatedAt: toIso(raw.updatedAt || raw.createdAt || nowIso())
  });

  const normalizeState = (raw = {}) => {
    const base = blankState();
    const techniques = Array.isArray(raw.techniques) ? raw.techniques.map(normalizeTechnique) : [];
    const uniqueTechniques = [...new Map(techniques.map((item) => [item.id, item])).values()];
    const combos = Array.isArray(raw.combos) ? raw.combos.map((item) => normalizeCombo(item, uniqueTechniques)) : [];
    const sessions = Array.isArray(raw.sessions || raw.journal) ? (raw.sessions || raw.journal).map(normalizeSession) : [];
    const sources = Array.isArray(raw.sources) ? raw.sources.map(normalizeSource) : [];
    const uniqueSources = [...new Map(sources.map((item) => [item.id, item])).values()];
    const sourceIds = new Set(uniqueSources.map((item) => item.id));
    const techniqueIds = new Set(uniqueTechniques.map((item) => item.id));
    const insights = Array.isArray(raw.insights) ? raw.insights.map((item) => normalizeInsight(item, sourceIds, techniqueIds)).filter((item) => item.sourceId) : [];
    return {
      version: APP_VERSION,
      profile: {
        ...base.profile,
        ...(raw.profile || {}),
        onboardingComplete: Boolean(raw.profile?.onboardingComplete),
        name: clean(raw.profile?.name || '', 40),
        discipline: clean(raw.profile?.discipline || 'Kickboxing', 40),
        stance: ['Orthodox', 'Southpaw', 'Switch'].includes(raw.profile?.stance) ? raw.profile.stance : 'Orthodox',
        goal: ['retain', 'technique', 'fitness', 'competition'].includes(raw.profile?.goal) ? raw.profile.goal : 'retain'
      },
      preferences: {
        ...base.preferences,
        ...(raw.preferences || {}),
        focusTechniqueId: raw.preferences?.focusTechniqueId ? String(raw.preferences.focusTechniqueId) : null,
        training: {
          ...base.preferences.training,
          ...(raw.preferences?.training || {}),
          rounds: clamp(raw.preferences?.training?.rounds || 3, 1, 10),
          roundLength: clamp(raw.preferences?.training?.roundLength || 120, 30, 600),
          restLength: clamp(raw.preferences?.training?.restLength || 30, 0, 180),
          promptInterval: clamp(raw.preferences?.training?.promptInterval || 8, 5, 30),
          voiceEnabled: raw.preferences?.training?.voiceEnabled !== false,
          cueEnabled: raw.preferences?.training?.cueEnabled !== false,
          combosEnabled: raw.preferences?.training?.combosEnabled !== false
        }
      },
      techniques: uniqueTechniques,
      combos: [...new Map(combos.map((item) => [item.id, item])).values()],
      sessions: [...new Map(sessions.map((item) => [item.id, item])).values()].sort((a, b) => dateValue(b.completedAt) - dateValue(a.completedAt)),
      sources: uniqueSources,
      insights: [...new Map(insights.map((item) => [item.id, item])).values()],
      reviewLog: Array.isArray(raw.reviewLog) ? raw.reviewLog.map((item) => ({
        id: clean(item.id || uid('review'), 120), techniqueId: clean(item.techniqueId, 120),
        grade: ['hard', 'good', 'easy'].includes(item.grade) ? item.grade : 'good', at: toIso(item.at || nowIso())
      })).slice(-5000) : []
    };
  };

  let databasePromise;
  const openDatabase = () => {
    if (!('indexedDB' in window)) return Promise.reject(new Error('IndexedDB unavailable'));
    if (databasePromise) return databasePromise;
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return databasePromise;
  };

  const dbRead = async (key) => {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  };

  const dbWrite = async (key, value) => {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(value, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  };

  const readLegacyState = () => {
    try {
      const techniques = JSON.parse(localStorage.getItem('fv-techniques') || 'null');
      const combos = JSON.parse(localStorage.getItem('fv-combos') || 'null');
      const journal = JSON.parse(localStorage.getItem('fv-journal') || 'null');
      if (!Array.isArray(techniques) && !Array.isArray(combos) && !Array.isArray(journal)) return null;
      return normalizeState({
        profile: { onboardingComplete: true, name: '', discipline: 'Kickboxing', stance: 'Orthodox', goal: 'retain' },
        techniques: techniques || [], combos: combos || [], journal: journal || []
      });
    } catch (_) {
      return null;
    }
  };

  let state = blankState();
  let saveTimer = 0;
  let saveSequence = 0;
  const markSaveState = (message) => {
    const element = $('#saveState');
    if (element) element.textContent = message;
  };
  const persistState = async () => {
    const sequence = ++saveSequence;
    markSaveState('Saving…');
    try {
      await dbWrite(STATE_KEY, state);
      if (sequence === saveSequence) markSaveState('Saved offline');
    } catch (error) {
      console.error(error);
      markSaveState('Save failed');
      toast('Could not save. Export a backup before closing.');
    }
  };
  const save = ({ immediate = false } = {}) => {
    window.clearTimeout(saveTimer);
    if (immediate) return persistState();
    saveTimer = window.setTimeout(persistState, 180);
    return Promise.resolve();
  };

  const toast = (message) => {
    const item = document.createElement('div');
    item.className = 'toast';
    item.textContent = message;
    $('#toastRegion').append(item);
    window.setTimeout(() => item.remove(), 2800);
  };

  const view = {
    route: 'today',
    vaultTab: 'techniques',
    category: 'All',
    search: '',
    reviewQueue: [],
    reviewIndex: 0,
    comboSequence: [],
    lastFocused: null,
    deferredInstall: null
  };

  const training = {
    status: 'idle',
    previousStatus: null,
    round: 0,
    settings: null,
    phaseEndsAt: 0,
    pausedRemaining: 0,
    startedAt: null,
    elapsedBeforePause: 0,
    prompts: [],
    pool: [],
    bag: [],
    lastPromptKey: null,
    tickTimer: 0,
    promptTimer: 0,
    wakeLock: null,
    draftSession: null
  };

  const weeklyData = () => {
    const start = getWeekStart();
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start.getTime() + (index * DAY));
      const next = new Date(date.getTime() + DAY);
      const seconds = state.sessions.filter((session) => {
        const time = dateValue(session.completedAt);
        return time >= date.getTime() && time < next.getTime();
      }).reduce((sum, session) => sum + durationForSession(session), 0);
      return { date, seconds };
    });
  };

  const getStreak = () => {
    const trainedDays = new Set(state.sessions.map((session) => startOfDay(new Date(session.completedAt)).getTime()));
    if (!trainedDays.size) return 0;
    let cursor = startOfDay();
    if (!trainedDays.has(cursor.getTime())) cursor = new Date(cursor.getTime() - DAY);
    let streak = 0;
    while (trainedDays.has(cursor.getTime())) {
      streak += 1;
      cursor = new Date(cursor.getTime() - DAY);
    }
    return streak;
  };

  const getDueTechniques = () => [...state.techniques]
    .filter(isDue)
    .sort((a, b) => dateValue(a.schedule.dueAt) - dateValue(b.schedule.dueAt) || a.confidence - b.confidence);

  const getWeakTechniques = () => [...state.techniques]
    .sort((a, b) => a.confidence - b.confidence || dateValue(a.lastTrainedAt) - dateValue(b.lastTrainedAt));

  const getFocusTechnique = () => state.techniques.find((item) => item.id === state.preferences.focusTechniqueId)
    || getDueTechniques()[0]
    || getWeakTechniques()[0]
    || null;

  const setRoute = () => {
    const requested = location.hash.replace(/^#/, '').split('?')[0];
    view.route = ROUTES.includes(requested) ? requested : 'today';
    if (!requested || requested !== view.route) history.replaceState(null, '', `#${view.route}`);
    $$('[data-page]').forEach((page) => { page.hidden = page.dataset.page !== view.route; });
    $$('[data-route]').forEach((link) => link.classList.toggle('active', link.dataset.route === view.route));
    const labels = { today: 'TODAY', vault: 'VAULT', train: 'TRAIN', progress: 'PROGRESS' };
    $('#mobileContext').textContent = labels[view.route];
    if (view.route === 'today') renderToday();
    if (view.route === 'vault') renderVault();
    if (view.route === 'train') renderTrainBuilder();
    if (view.route === 'progress') renderProgress();
    window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    document.title = `${labels[view.route][0]}${labels[view.route].slice(1).toLowerCase()} — Fight Vault`;
  };

  const signalCard = (value, label, symbol) => `<div class="signal-card"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span><em aria-hidden="true">${escapeHtml(symbol)}</em></div>`;
  const emptyState = (title, description, actionLabel = '', action = '') => `<div class="empty-state"><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(description)}</p>${actionLabel ? `<button class="button button-accent" type="button" data-action="${escapeHtml(action)}">${escapeHtml(actionLabel)}</button>` : ''}</div></div>`;

  const renderWeekBars = (element, compact = false) => {
    const data = weeklyData();
    const maximum = Math.max(...data.map((item) => item.seconds), 60);
    if (compact) {
      element.innerHTML = data.map((item) => {
        const percentage = item.seconds ? Math.max(8, (item.seconds / maximum) * 100) : 4;
        return `<div class="mini-day ${item.seconds ? 'active' : ''}"><i style="height:${percentage}%"></i><span>${formatDate(item.date, { weekday: 'narrow' })}</span></div>`;
      }).join('');
      return;
    }
    element.innerHTML = data.map((item) => {
      const percentage = item.seconds ? Math.max(5, (item.seconds / maximum) * 100) : 3;
      return `<div class="chart-day"><div class="chart-day-bar-wrap"><i class="chart-day-bar ${item.seconds ? 'active' : ''}" style="height:${percentage}%"><span>${item.seconds ? formatMinutes(item.seconds) : ''}</span></i></div><span>${formatDate(item.date, { weekday: 'short' })}</span></div>`;
    }).join('');
  };

  const renderToday = () => {
    const due = getDueTechniques();
    const insightInbox = state.insights.filter((item) => item.status === 'inbox');
    const focus = getFocusTechnique();
    const weekSeconds = state.sessions.filter((session) => withinCurrentWeek(session.completedAt)).reduce((sum, session) => sum + durationForSession(session), 0);
    const name = clean(state.profile.name, 40);
    $('#topbarGreeting').textContent = name ? `Ready to work, ${name}?` : 'Ready to work?';
    $('#todayDate').textContent = formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' });
    $('#avatarInitial').textContent = (name || 'F').slice(0, 1).toUpperCase();
    $('#heroDueNumber').textContent = String(due.length);

    if (!state.techniques.length) {
      $('#todayEyebrow').textContent = 'START WITH ONE REAL LESSON';
      $('#todayHeading').textContent = 'Build a vault worth training.';
      $('#todaySupport').textContent = 'Capture one correction from your last class. That is enough to create your first review and hands-free round.';
      $('#heroTrainButton').disabled = true;
    } else {
      $('#todayEyebrow').textContent = due.length ? `${due.length} ITEM${due.length === 1 ? '' : 'S'} READY FOR RECALL` : 'YOUR TRAINING, REMEMBERED';
      $('#todayHeading').textContent = due.length ? 'Turn recall into reaction.' : 'Make the last lesson stick.';
      $('#todaySupport').textContent = due.length ? 'Review the coaching details first, then put them into a spoken training round.' : 'Your reviews are clear. A smart session will reinforce low-confidence techniques.';
      $('#heroTrainButton').disabled = false;
    }

    $('#signalGrid').innerHTML = [
      signalCard(due.length, due.length === 1 ? 'Review due' : 'Reviews due', '◆'),
      signalCard(formatMinutes(weekSeconds), 'Trained this week', '◉'),
      signalCard(state.sessions.filter((item) => withinCurrentWeek(item.completedAt)).length, 'Sessions this week', '↗'),
      signalCard(state.techniques.filter((item) => item.confidence >= 4).length, 'Sharp techniques', '✓')
    ].join('');

    const plan = [];
    if (!state.techniques.length) {
      plan.push({ title: 'Capture your first correction', text: 'Technique + one coaching cue · under 20 seconds', action: 'capture', label: 'Capture' });
    } else {
      if (due.length) plan.push({ title: `Recall ${due.length} coaching ${due.length === 1 ? 'cue' : 'cues'}`, text: `${due.slice(0, 2).map((item) => item.name).join(' · ')}${due.length > 2 ? ` +${due.length - 2}` : ''}`, action: 'review', label: 'Review' });
      if (insightInbox.length) plan.push({ title: `Process ${insightInbox.length} film ${insightInbox.length === 1 ? 'insight' : 'insights'}`, text: 'Approve what is useful before it enters your training', action: 'film-study', label: 'Open inbox' });
      plan.push({ title: 'Run a smart session', text: `${state.preferences.training.rounds} rounds · ${formatMinutes(state.preferences.training.rounds * state.preferences.training.roundLength)}`, action: 'train', label: 'Build session' });
      plan.push({ title: 'Capture today’s correction', text: 'Save the detail that will matter tomorrow', action: 'capture', label: 'Capture' });
    }
    $('#todayPlan').innerHTML = plan.map((item, index) => `<article class="plan-item"><span class="plan-number">${String(index + 1).padStart(2, '0')}</span><div class="plan-copy"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.text)}</small></div><button class="plan-action" type="button" data-action="${item.action}">${escapeHtml(item.label)}</button></article>`).join('');

    if (due.length) {
      $('#duePreview').innerHTML = due.slice(0, 4).map((technique) => `<button class="review-preview-card" type="button" data-action="review-one" data-id="${escapeHtml(technique.id)}"><span>${categoryCode(technique.category)}</span><span><strong>${escapeHtml(technique.name)}</strong><small>${escapeHtml(technique.cue || 'Recall the key details')}</small></span><i>›</i></button>`).join('');
      $('#reviewAllButton').hidden = false;
    } else {
      $('#duePreview').innerHTML = emptyState(state.techniques.length ? 'You are caught up.' : 'Nothing to review yet.', state.techniques.length ? 'Start a smart session or capture a new correction.' : 'Your first captured correction will be ready immediately.', state.techniques.length ? 'Start training' : 'Capture correction', state.techniques.length ? 'train' : 'capture');
      $('#reviewAllButton').hidden = true;
    }

    if (focus) {
      $('#focusTitle').textContent = focus.name;
      $('#focusCue').textContent = focus.cue || focus.notes || 'Add one coaching cue to make this focus useful during training.';
      $('#focusMeta').innerHTML = `<span class="chip">${escapeHtml(focus.category)}</span><span class="chip">Confidence ${focus.confidence}/5</span><span class="chip">${escapeHtml(formatRelativeDue(focus.schedule.dueAt))}</span>`;
      $('#sidebarActionTitle').textContent = due.length ? `${due.length} review${due.length === 1 ? '' : 's'} due` : 'Smart session ready';
      $('#sidebarActionText').textContent = focus.cue || `Put ${focus.name} into today’s work.`;
      $('#sidebarActionButton').textContent = due.length ? 'Start review' : 'Start session';
      $('#sidebarActionButton').dataset.action = due.length ? 'review' : 'train';
    } else {
      $('#focusTitle').textContent = 'No focus selected';
      $('#focusCue').textContent = 'Capture one correction from your last class to create a meaningful focus.';
      $('#focusMeta').innerHTML = '';
      $('#sidebarActionTitle').textContent = 'Build your vault';
      $('#sidebarActionText').textContent = 'Capture one correction from your last class.';
      $('#sidebarActionButton').textContent = 'Quick capture';
      $('#sidebarActionButton').dataset.action = 'capture';
    }

    $('#weeklyMinutes').textContent = formatMinutes(weekSeconds);
    renderWeekBars($('#miniWeek'), true);
    $('#weeklyNote').textContent = weekSeconds ? `${state.sessions.filter((item) => withinCurrentWeek(item.completedAt)).length} completed session${state.sessions.filter((item) => withinCurrentWeek(item.completedAt)).length === 1 ? '' : 's'} this week.` : 'Your first completed session will appear here.';
    updateDueBadges();
  };

  const techniqueCard = (technique) => `<article class="technique-card" role="button" tabindex="0" data-action="edit-technique" data-id="${escapeHtml(technique.id)}" style="--card-tint:${categoryTint(technique.category)}" aria-label="Open ${escapeHtml(technique.name)}"><div class="technique-card-top"><span class="category-mark large-mark">${categoryCode(technique.category)}</span>${isDue(technique) ? '<span class="due-label">DUE</span>' : `<span class="status-pill">${escapeHtml(formatRelativeDue(technique.schedule.dueAt))}</span>`}</div><div class="technique-card-body"><div class="micro-label">${escapeHtml(technique.category)} · ${escapeHtml(technique.stance)}</div><h3>${escapeHtml(technique.name)}</h3><blockquote>${escapeHtml(technique.cue || technique.notes || 'Add a coaching cue to make this trainable.')}</blockquote><div class="confidence-row"><span>Confidence ${technique.confidence}/5</span><span>${technique.trainingCount}× trained</span></div><div class="confidence-track"><i style="width:${technique.confidence * 20}%"></i></div></div></article>`;

  const comboCard = (combo) => `<article class="combo-card" style="--card-tint:rgba(179,124,255,.1)"><div class="combo-card-top"><span class="category-mark large-mark">SEQ</span><button class="card-menu" type="button" data-action="edit-combo" data-id="${escapeHtml(combo.id)}" aria-label="Edit ${escapeHtml(combo.name)}">•••</button></div><div class="combo-card-body"><div class="micro-label">${combo.steps.length} STEP COMBINATION</div><h3>${escapeHtml(combo.name)}</h3><p>${escapeHtml(combo.purpose || 'No purpose saved yet.')}</p><div class="sequence-chips">${combo.steps.map((step, index) => `${index ? '<i>→</i>' : ''}<span>${escapeHtml(comboStepName(step))}</span>`).join('')}</div></div></article>`;

  const sourceDuration = (source) => Math.max(0, ...source.segments.map((segment) => segment.endSec ?? segment.startSec ?? 0));
  const sourceCard = (source) => {
    const activeInsights = state.insights.filter((item) => item.sourceId === source.id && item.status !== 'dismissed');
    const duration = sourceDuration(source);
    return `<article class="source-card" role="button" tabindex="0" data-action="open-source" data-id="${escapeHtml(source.id)}" aria-label="Open film source ${escapeHtml(source.title)}"><div class="source-card-top"><span class="youtube-mark"><i>▶</i> YOUTUBE</span><span class="status-pill">${duration ? escapeHtml(formatTimestamp(duration)) : 'TEXT'}</span></div><div class="source-card-body"><div class="micro-label">${escapeHtml(source.topic || source.creator || 'FILM STUDY')}</div><h3>${escapeHtml(source.title)}</h3><p>${escapeHtml(source.creator || 'Creator not recorded')}</p><div class="source-card-meta"><span class="chip">${source.segments.length} segments</span><span class="chip">${activeInsights.length} insights</span><span class="chip">${activeInsights.filter((item) => item.status === 'connected').length} connected</span></div></div></article>`;
  };

  const insightTypeCode = (type) => ({ Principle: 'WHY', 'Coaching cue': 'CUE', 'Common mistake': 'ERR', Drill: 'DRL', 'Combination idea': 'SEQ', 'Review question': 'ASK' })[type] || 'IDEA';
  const insightCard = (insight) => {
    const source = state.sources.find((item) => item.id === insight.sourceId);
    if (!source) return '';
    return `<article class="insight-card"><span class="insight-type-mark">${insightTypeCode(insight.type)}</span><div class="insight-card-main"><div class="insight-card-head"><div><div class="micro-label">${escapeHtml(insight.type)}</div><h3>${escapeHtml(insight.title)}</h3></div>${insight.techniqueId ? `<span class="status-pill">Suggested: ${escapeHtml(techniqueName(insight.techniqueId))}</span>` : ''}</div><p>${escapeHtml(insight.body)}</p><div class="insight-source-line"><span>${escapeHtml(source.title)}</span><span>${insight.timestampSec !== null ? `@ ${escapeHtml(formatTimestamp(insight.timestampSec))}` : 'Untimed'}</span></div><div class="insight-card-actions"><button class="approve-insight" type="button" data-action="connect-insight" data-id="${escapeHtml(insight.id)}">Connect insight</button><a href="${escapeHtml(youtubeAt(source, insight.timestampSec))}" target="_blank" rel="noopener noreferrer">Watch moment ↗</a><button type="button" data-action="dismiss-insight" data-id="${escapeHtml(insight.id)}">Dismiss</button></div></div></article>`;
  };

  const renderFilmStudy = () => {
    const search = view.search.toLowerCase();
    const activeInsights = state.insights.filter((item) => item.status !== 'dismissed');
    const inbox = activeInsights.filter((item) => item.status === 'inbox' && [item.title, item.body, item.type, sourceName(item.sourceId)].some((value) => String(value).toLowerCase().includes(search)));
    const sources = state.sources.filter((source) => [source.title, source.creator, source.topic, ...source.segments.slice(0, 100).map((segment) => segment.text)].some((value) => String(value).toLowerCase().includes(search)));
    const totalSeconds = state.sources.reduce((sum, source) => sum + sourceDuration(source), 0);
    $('#filmSignals').innerHTML = [
      `<div class="film-stat"><strong>${state.sources.length}</strong><span>Video sources</span></div>`,
      `<div class="film-stat"><strong>${totalSeconds ? (totalSeconds < 60 ? `${Math.round(totalSeconds)}s` : formatMinutes(totalSeconds)) : '0m'}</strong><span>Timestamped material</span></div>`,
      `<div class="film-stat"><strong>${activeInsights.filter((item) => item.status === 'inbox').length}</strong><span>Inbox insights</span></div>`,
      `<div class="film-stat"><strong>${activeInsights.filter((item) => item.status === 'connected').length}</strong><span>Connected insights</span></div>`
    ].join('');
    const inboxTotal = activeInsights.filter((item) => item.status === 'inbox').length;
    $('#insightInboxCount').textContent = `${inboxTotal} insight${inboxTotal === 1 ? '' : 's'}`;
    $('#insightInbox').innerHTML = inbox.length ? inbox.map(insightCard).join('') : emptyState(inboxTotal ? 'No matching inbox insights.' : 'Your Insight Inbox is clear.', inboxTotal ? 'Try another search.' : 'Open a source and turn a useful transcript moment into an insight.');
    $('#sourceGrid').innerHTML = sources.length ? sources.map(sourceCard).join('') : emptyState(state.sources.length ? 'No matching sources.' : 'Your film room is empty.', state.sources.length ? 'Try another search.' : 'Import a YouTube transcript to begin connecting analysis with training.', state.sources.length ? '' : 'Import film source', 'new-source');
  };

  const renderVault = () => {
    $('#techniqueTabCount').textContent = state.techniques.length;
    $('#comboTabCount').textContent = state.combos.length;
    $('#sourceTabCount').textContent = state.sources.length;
    $$('[data-vault-tab]').forEach((button) => button.classList.toggle('active', button.dataset.vaultTab === view.vaultTab));
    $('#techniqueVault').hidden = view.vaultTab !== 'techniques';
    $('#combinationVault').hidden = view.vaultTab !== 'combinations';
    $('#filmStudyVault').hidden = view.vaultTab !== 'film-study';
    $('#newFilmSourceButton').hidden = view.vaultTab !== 'film-study';
    $('#newComboButton').hidden = view.vaultTab !== 'combinations';
    $('#vaultCaptureButton').hidden = view.vaultTab !== 'techniques';
    $('#vaultSearch').placeholder = view.vaultTab === 'film-study' ? 'Search sources, transcripts, and insights…' : view.vaultTab === 'combinations' ? 'Search combinations and movements…' : 'Search techniques, cues, notes…';
    const categories = ['All', ...new Set(state.techniques.map((item) => item.category))];
    if (!categories.includes(view.category)) view.category = 'All';
    $('#categoryFilters').innerHTML = categories.map((category) => `<button class="filter-chip ${view.category === category ? 'active' : ''}" type="button" data-action="filter-category" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`).join('');
    const search = view.search.toLowerCase();
    const techniques = state.techniques.filter((item) => (view.category === 'All' || item.category === view.category) && [item.name, item.cue, item.notes, item.category].some((value) => String(value).toLowerCase().includes(search)));
    $('#techniqueGrid').innerHTML = techniques.length ? techniques.map(techniqueCard).join('') : emptyState(state.techniques.length ? 'No matching techniques.' : 'Your vault is empty.', state.techniques.length ? 'Try another search or category.' : 'Capture the last correction your coach gave you.', state.techniques.length ? '' : 'Capture correction', 'capture');
    const combos = state.combos.filter((item) => [item.name, item.purpose, ...item.steps.map(comboStepName)].some((value) => String(value).toLowerCase().includes(search)));
    $('#comboGrid').innerHTML = combos.length ? combos.map(comboCard).join('') : emptyState(state.combos.length ? 'No matching combinations.' : 'No combinations yet.', state.techniques.length ? 'Build a sequence from techniques already in your vault.' : 'Capture techniques first, then connect them.', state.techniques.length ? 'Build combination' : 'Capture correction', state.techniques.length ? 'new-combo' : 'capture');
    if (view.vaultTab === 'film-study') renderFilmStudy();
  };

  const renderProgress = () => {
    const weekSeconds = state.sessions.filter((session) => withinCurrentWeek(session.completedAt)).reduce((sum, session) => sum + durationForSession(session), 0);
    const averageConfidence = state.techniques.length ? Math.round((state.techniques.reduce((sum, item) => sum + item.confidence, 0) / (state.techniques.length * 5)) * 100) : 0;
    const reviewedThisWeek = state.reviewLog.filter((item) => withinCurrentWeek(item.at)).length;
    $('#progressSignals').innerHTML = [
      signalCard(formatMinutes(weekSeconds), 'Minutes this week', '◉'),
      signalCard(getStreak(), 'Day training streak', '↗'),
      signalCard(`${averageConfidence}%`, 'Vault confidence', '✓'),
      signalCard(reviewedThisWeek, 'Reviews completed', '◆')
    ].join('');
    renderWeekBars($('#weekChart'));

    $('#sessionList').innerHTML = state.sessions.length ? state.sessions.slice(0, 20).map((session) => {
      const reflection = session.reflection || { win: '', improve: '' };
      const focusNames = session.techniqueIds.map(techniqueName).slice(0, 3);
      const title = session.source === 'external' ? session.mode : `${session.rounds || 1}-round ${session.mode}`;
      return `<article class="session-card"><span class="session-icon" aria-hidden="true">${session.source === 'external' ? '✎' : '◉'}</span><div><div class="session-card-head"><div><h3>${escapeHtml(title)}</h3><time datetime="${escapeHtml(session.completedAt)}">${escapeHtml(formatDate(session.completedAt, { weekday: 'short', day: 'numeric', month: 'short' }))} · ${escapeHtml(formatMinutes(session.durationSec))}</time></div><span class="status-pill">${escapeHtml(session.feeling)}</span></div>${focusNames.length || session.focus ? `<p>${escapeHtml(session.focus || focusNames.join(' · '))}</p>` : ''}${reflection.win || reflection.improve ? `<div class="reflection-line">${reflection.win ? `<span><strong>Win:</strong> ${escapeHtml(reflection.win)}</span>` : ''}${reflection.improve ? `<span><strong>Next:</strong> ${escapeHtml(reflection.improve)}</span>` : ''}</div>` : ''}</div></article>`;
    }).join('') : emptyState('No sessions logged yet.', 'Complete a Fight Vault round or log your latest class.', 'Start training', 'train');

    const weak = getWeakTechniques().slice(0, 5);
    $('#weakList').innerHTML = weak.length ? weak.map((item) => `<button class="weak-item" type="button" data-action="edit-technique" data-id="${escapeHtml(item.id)}"><span class="category-mark">${categoryCode(item.category)}</span><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.cue || 'No cue saved')}</small></span><span>${item.confidence}/5</span></button>`).join('') : '<p class="panel-footnote">Capture a technique to start tracking what needs attention.</p>';
    const latestWithLesson = state.sessions.find((item) => item.reflection?.improve) || null;
    const latestTechnique = [...state.techniques].sort((a, b) => dateValue(b.updatedAt) - dateValue(a.updatedAt)).find((item) => item.cue);
    $('#latestLesson').textContent = latestWithLesson?.reflection.improve || latestTechnique?.cue || 'Capture a correction after class and it will stay visible here.';
  };

  const buildTrainingPool = () => {
    const settings = state.preferences.training;
    let techniques = [];
    if (settings.mode === 'smart') {
      techniques = [...new Map([...getDueTechniques(), ...getWeakTechniques()].map((item) => [item.id, item])).values()].slice(0, 12);
    } else if (settings.mode === 'category') {
      techniques = state.techniques.filter((item) => item.category === settings.category);
    } else if (settings.mode === 'combinations') {
      techniques = [];
    } else {
      techniques = [...state.techniques];
    }
    const prompts = techniques.map((item) => {
      const insightCues = getTechniqueInsights(item.id).filter((insight) => insight.type !== 'Review question').map((insight) => insight.body);
      return { type: 'technique', id: item.id, name: item.name, cue: item.cue, cueOptions: [...new Set([item.cue, ...insightCues].filter(Boolean))], category: item.category };
    });
    const includeCombos = settings.mode === 'combinations' || (settings.combosEnabled && settings.mode !== 'techniques' && settings.mode !== 'category');
    if (includeCombos) {
      state.combos.forEach((combo) => prompts.push({ type: 'combo', id: combo.id, name: comboSpokenName(combo) || combo.name, displayName: combo.name, cue: combo.purpose, category: 'Combination' }));
    }
    return prompts;
  };

  const updateTrainingEstimate = () => {
    const settings = state.preferences.training;
    const seconds = (settings.rounds * settings.roundLength) + ((settings.rounds - 1) * settings.restLength);
    $('#estimatedDuration').textContent = `${Math.max(1, Math.round(seconds / 60))} MIN`;
    $('#roundCounter').textContent = `${settings.rounds} ROUND${settings.rounds === 1 ? '' : 'S'}`;
    $('#stageTimer').textContent = formatDuration(settings.roundLength);
    $('#promptIntervalOutput').textContent = `Every ${settings.promptInterval} sec`;
  };

  const renderTrainBuilder = () => {
    const settings = state.preferences.training;
    $('#trainingMode').value = settings.mode;
    $('#roundCount').value = String(settings.rounds);
    $('#roundLength').value = String(settings.roundLength);
    $('#restLength').value = String(settings.restLength);
    $('#promptInterval').value = String(settings.promptInterval);
    $('#voiceEnabled').checked = settings.voiceEnabled;
    $('#cueEnabled').checked = settings.cueEnabled;
    $('#combosEnabled').checked = settings.combosEnabled;
    const availableCategories = [...new Set(state.techniques.map((item) => item.category))];
    $('#trainingCategory').innerHTML = (availableCategories.length ? availableCategories : CATEGORIES).map((category) => `<option>${escapeHtml(category)}</option>`).join('');
    if (![...$('#trainingCategory').options].some((option) => option.value === settings.category)) settings.category = $('#trainingCategory').options[0]?.value || 'Other';
    $('#trainingCategory').value = settings.category;
    $('#trainingCategory').hidden = settings.mode !== 'category';
    $('#combosEnabled').disabled = settings.mode === 'combinations' || settings.mode === 'techniques' || settings.mode === 'category';
    const pool = buildTrainingPool();
    $('#builderFocus').innerHTML = pool.slice(0, 8).map((item) => `<span class="chip">${escapeHtml(item.displayName || item.name)}</span>`).join('') + (pool.length > 8 ? `<span class="chip">+${pool.length - 8}</span>` : '');
    updateTrainingEstimate();
    setBuilderDisabled(training.status !== 'idle');
  };

  const setBuilderDisabled = (disabled) => {
    ['trainingMode', 'trainingCategory', 'roundCount', 'roundLength', 'restLength', 'promptInterval', 'voiceEnabled', 'cueEnabled', 'combosEnabled'].forEach((id) => { $(`#${id}`).disabled = disabled || (id === 'combosEnabled' && ['combinations', 'techniques', 'category'].includes(state.preferences.training.mode)); });
  };

  const updateDueBadges = () => {
    const count = getDueTechniques().length;
    $('#sideDueCount').hidden = !count;
    $('#mobileDueDot').hidden = !count;
    if (count) $('#sideDueCount').textContent = count > 99 ? '99+' : String(count);
  };

  const updateAll = () => {
    renderToday();
    if (view.route === 'vault') renderVault();
    if (view.route === 'train') renderTrainBuilder();
    if (view.route === 'progress') renderProgress();
  };

  const closeDialog = () => {
    const layer = $('#modalLayer');
    if (!layer.classList.contains('open')) return;
    layer.classList.remove('open');
    layer.replaceChildren();
    document.body.classList.remove('modal-open');
    view.lastFocused?.focus?.();
    view.lastFocused = null;
  };

  const openDialogNode = (node, { wide = false, onOpen } = {}) => {
    closeDialog();
    view.lastFocused = document.activeElement;
    const panel = document.createElement('div');
    panel.className = `dialog-panel${wide ? ' wide' : ''}`;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.append(node);
    const heading = $('h2', panel);
    if (heading) {
      heading.id ||= uid('dialog-title');
      panel.setAttribute('aria-labelledby', heading.id);
    }
    $('#modalLayer').append(panel);
    $('#modalLayer').classList.add('open');
    document.body.classList.add('modal-open');
    $$('[data-close-dialog]', panel).forEach((button) => button.addEventListener('click', closeDialog));
    onOpen?.(panel);
    window.setTimeout(() => $('input:not([type="hidden"]), select, textarea, button', panel)?.focus(), 20);
    return panel;
  };

  const openTemplate = (id, options = {}) => openDialogNode($(`#${id}`).content.cloneNode(true), options);

  const setupDictation = (panel) => {
    $$('[data-dictate]', panel).forEach((button) => {
      button.addEventListener('click', () => {
        const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!Recognition) {
          toast('Voice dictation is not supported in this browser.');
          return;
        }
        const input = panel.querySelector(`[name="${button.dataset.dictate}"]`);
        const recognition = new Recognition();
        recognition.lang = document.documentElement.lang || 'en';
        recognition.interimResults = true;
        recognition.continuous = false;
        button.classList.add('listening');
        button.setAttribute('aria-label', 'Listening…');
        recognition.onresult = (event) => {
          const transcript = [...event.results].map((result) => result[0].transcript).join(' ');
          input.value = clean(`${input.value} ${transcript}`, 300);
        };
        recognition.onerror = () => toast('Dictation stopped. You can keep typing.');
        recognition.onend = () => {
          button.classList.remove('listening');
          button.setAttribute('aria-label', 'Dictate coaching cue');
          input.focus();
        };
        recognition.start();
      });
    });
  };

  const createTechniqueFromForm = (form, existing = null) => {
    const data = new FormData(form);
    const timestamp = nowIso();
    return normalizeTechnique({
      ...(existing || {}),
      id: existing?.id || uid('tech'),
      name: data.get('name'), category: data.get('category'), stance: data.get('stance') || state.profile.stance,
      confidence: data.get('confidence'), cue: data.get('cue'), steps: lines(data.get('steps')),
      keys: lines(data.get('keys')), mistakes: lines(data.get('mistakes')), notes: data.get('notes'), mediaUrl: data.get('mediaUrl'),
      createdAt: existing?.createdAt || timestamp, updatedAt: timestamp,
      schedule: existing?.schedule || normalizeSchedule()
    });
  };

  const openQuickCapture = () => {
    openTemplate('quickCaptureTemplate', {
      onOpen: (panel) => {
        const form = $('#quickCaptureForm', panel);
        setupDictation(panel);
        form.addEventListener('submit', async (event) => {
          event.preventDefault();
          const technique = createTechniqueFromForm(form);
          state.techniques.unshift(technique);
          state.preferences.focusTechniqueId = technique.id;
          await save({ immediate: true });
          closeDialog();
          updateAll();
          toast(`${technique.name} added to today’s focus.`);
        });
      }
    });
  };

  const openTechniqueForm = (id) => {
    const technique = state.techniques.find((item) => item.id === id);
    if (!technique) return;
    openTemplate('techniqueFormTemplate', {
      wide: true,
      onOpen: (panel) => {
        const form = $('#techniqueForm', panel);
        const values = { ...technique, steps: technique.steps.join('\n'), keys: technique.keys.join('\n'), mistakes: technique.mistakes.join('\n') };
        Object.entries(values).forEach(([key, value]) => { if (form.elements[key] && typeof value !== 'object') form.elements[key].value = value ?? ''; });
        if (technique.mediaUrl) {
          $('#openReferenceLink', panel).href = technique.mediaUrl;
          $('#openReferenceLink', panel).hidden = false;
        }
        const linked = getTechniqueInsights(technique.id);
        if (linked.length) {
          $('#linkedInsights', panel).hidden = false;
          $('#linkedInsightList', panel).innerHTML = linked.map((insight) => {
            const source = state.sources.find((item) => item.id === insight.sourceId);
            return `<div class="linked-insight-item"><span><strong>${escapeHtml(insight.title)}</strong><small>${escapeHtml(insight.type)} · ${escapeHtml(source?.title || 'Unknown source')}</small></span>${source ? `<a href="${escapeHtml(youtubeAt(source, insight.timestampSec))}" target="_blank" rel="noopener noreferrer">${insight.timestampSec !== null ? escapeHtml(formatTimestamp(insight.timestampSec)) : 'Open'} ↗</a>` : ''}</div>`;
          }).join('');
        }
        form.addEventListener('submit', async (event) => {
          event.preventDefault();
          const updated = createTechniqueFromForm(form, technique);
          state.techniques[state.techniques.findIndex((item) => item.id === id)] = updated;
          await save({ immediate: true });
          closeDialog();
          updateAll();
          toast('Technique updated.');
        });
        $('#deleteTechniqueButton', panel).addEventListener('click', async () => {
          if (!confirm(`Delete “${technique.name}”? It will also be removed from linked combinations.`)) return;
          state.techniques = state.techniques.filter((item) => item.id !== id);
          state.combos = state.combos.map((combo) => ({ ...combo, steps: combo.steps.filter((step) => step.techniqueId !== id) }));
          state.insights = state.insights.map((insight) => insight.techniqueId === id ? { ...insight, techniqueId: null, status: 'inbox', connectionType: null, updatedAt: nowIso() } : insight);
          if (state.preferences.focusTechniqueId === id) state.preferences.focusTechniqueId = null;
          await save({ immediate: true });
          closeDialog();
          updateAll();
          toast('Technique deleted.');
        });
      }
    });
  };

  const renderComboSequence = (panel) => {
    $('#comboSequenceList', panel).innerHTML = view.comboSequence.length ? view.comboSequence.map((step, index) => `<div class="sequence-row"><span>${index + 1}</span><strong>${escapeHtml(comboStepName(step))}</strong><button type="button" data-sequence-action="up" data-index="${index}" aria-label="Move ${escapeHtml(comboStepName(step))} up">↑</button><button type="button" data-sequence-action="down" data-index="${index}" aria-label="Move ${escapeHtml(comboStepName(step))} down">↓</button><button type="button" data-sequence-action="remove" data-index="${index}" aria-label="Remove ${escapeHtml(comboStepName(step))}">×</button></div>`).join('') : '<div class="empty-state" style="min-height:120px"><div><strong>No steps yet.</strong><p>Select a technique above to build the sequence.</p></div></div>';
  };

  const openComboForm = (id = null) => {
    if (!state.techniques.length) {
      toast('Capture at least one technique before building a combination.');
      openQuickCapture();
      return;
    }
    const existing = id ? state.combos.find((item) => item.id === id) : null;
    view.comboSequence = existing ? existing.steps.map((step) => ({ ...step })) : [];
    openTemplate('comboFormTemplate', {
      wide: true,
      onOpen: (panel) => {
        const form = $('#comboForm', panel);
        if (existing) {
          form.elements.id.value = existing.id;
          form.elements.name.value = existing.name;
          form.elements.purpose.value = existing.purpose;
        } else {
          $('#deleteComboButton', panel).hidden = true;
        }
        $('#comboTechniqueSelect', panel).innerHTML = state.techniques.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} · ${escapeHtml(item.category)}</option>`).join('');
        renderComboSequence(panel);
        $('#addComboStep', panel).addEventListener('click', () => {
          const techniqueId = $('#comboTechniqueSelect', panel).value;
          const technique = state.techniques.find((item) => item.id === techniqueId);
          if (!technique) return;
          view.comboSequence.push({ techniqueId: technique.id, label: technique.name });
          renderComboSequence(panel);
        });
        $('#comboSequenceList', panel).addEventListener('click', (event) => {
          const button = event.target.closest('[data-sequence-action]');
          if (!button) return;
          const index = Number(button.dataset.index);
          const action = button.dataset.sequenceAction;
          if (action === 'remove') view.comboSequence.splice(index, 1);
          if (action === 'up' && index > 0) [view.comboSequence[index - 1], view.comboSequence[index]] = [view.comboSequence[index], view.comboSequence[index - 1]];
          if (action === 'down' && index < view.comboSequence.length - 1) [view.comboSequence[index + 1], view.comboSequence[index]] = [view.comboSequence[index], view.comboSequence[index + 1]];
          renderComboSequence(panel);
        });
        form.addEventListener('submit', async (event) => {
          event.preventDefault();
          if (!view.comboSequence.length) {
            toast('Add at least one technique to the sequence.');
            return;
          }
          const data = new FormData(form);
          const combo = normalizeCombo({
            ...(existing || {}), id: existing?.id || uid('combo'), name: data.get('name'), purpose: data.get('purpose'),
            steps: view.comboSequence, createdAt: existing?.createdAt || nowIso(), updatedAt: nowIso()
          }, state.techniques);
          if (existing) state.combos[state.combos.findIndex((item) => item.id === existing.id)] = combo;
          else state.combos.unshift(combo);
          await save({ immediate: true });
          closeDialog();
          view.vaultTab = 'combinations';
          renderVault();
          toast(existing ? 'Combination updated.' : 'Combination created.');
        });
        $('#deleteComboButton', panel).addEventListener('click', async () => {
          if (!existing || !confirm(`Delete “${existing.name}”?`)) return;
          state.combos = state.combos.filter((item) => item.id !== existing.id);
          await save({ immediate: true });
          closeDialog();
          renderVault();
          toast('Combination deleted.');
        });
      }
    });
  };

  const openFilmSourceForm = () => {
    openTemplate('filmSourceTemplate', {
      wide: true,
      onOpen: (panel) => {
        const form = $('#filmSourceForm', panel);
        $('#captionFile', panel).addEventListener('change', async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          if (file.size > 5_000_000) {
            toast('That caption file is too large. Keep it under 5 MB.');
            event.target.value = '';
            return;
          }
          try {
            form.elements.transcript.value = (await file.text()).slice(0, 1_500_000);
            $('#captionFileState', panel).textContent = `${file.name} · ${Math.max(1, Math.round(file.size / 1024))} KB`;
          } catch (_) {
            toast('Fight Vault could not read that caption file.');
          }
        });
        form.addEventListener('submit', async (event) => {
          event.preventDefault();
          const data = new FormData(form);
          const url = safeUrl(data.get('url'));
          const videoId = youtubeVideoId(url);
          if (!videoId) {
            toast('Enter a valid YouTube video, Shorts, live, or youtu.be URL.');
            form.elements.url.focus();
            return;
          }
          const transcriptText = String(data.get('transcript') || '').slice(0, 1_500_000);
          const segments = parseTranscript(transcriptText);
          if (!segments.length) {
            toast('No readable transcript text was found.');
            form.elements.transcript.focus();
            return;
          }
          if (state.sources.some((source) => source.videoId === videoId) && !confirm('This video is already in Film Study. Import another copy?')) return;
          const source = normalizeSource({
            id: uid('source'), url, videoId, title: data.get('title'), creator: data.get('creator'), topic: data.get('topic'),
            transcriptText, segments, createdAt: nowIso(), updatedAt: nowIso()
          });
          state.sources.unshift(source);
          await save({ immediate: true });
          closeDialog();
          view.vaultTab = 'film-study';
          view.search = '';
          $('#vaultSearch').value = '';
          renderVault();
          toast(`${source.segments.length} transcript segment${source.segments.length === 1 ? '' : 's'} imported.`);
        });
      }
    });
  };

  const openSourceReader = (id) => {
    const source = state.sources.find((item) => item.id === id);
    if (!source) return;
    const activeInsights = state.insights.filter((item) => item.sourceId === source.id && item.status !== 'dismissed');
    const insightSummary = activeInsights.length ? `<section class="source-insight-summary"><div class="section-heading"><div><p class="micro-label">FROM THIS SOURCE</p><h3>Saved insights</h3></div><span class="status-pill">${activeInsights.length}</span></div><div>${activeInsights.map((insight) => `<article><span class="insight-type-mark">${insightTypeCode(insight.type)}</span><span><strong>${escapeHtml(insight.title)}</strong><small>${insight.status === 'connected' ? (insight.techniqueId ? `Connected to ${escapeHtml(techniqueName(insight.techniqueId))}` : 'Approved source insight') : 'Waiting in Insight Inbox'}</small></span>${insight.status === 'inbox' ? `<button type="button" data-reader-connect="${escapeHtml(insight.id)}">Connect</button>` : '<i>✓</i>'}</article>`).join('')}</div></section>` : '';
    const wrapper = document.createElement('div');
    wrapper.className = 'source-reader';
    wrapper.innerHTML = `<div class="dialog-head"><div><p class="micro-label">FILM SOURCE</p><h2 style="position:absolute;width:1px;height:1px;overflow:hidden">${escapeHtml(source.title)}</h2></div><button class="dialog-close" type="button" data-close-dialog aria-label="Close">×</button></div><div class="source-reader-hero"><span class="youtube-mark"><i>▶</i> YOUTUBE FILM STUDY</span><h2>${escapeHtml(source.title)}</h2><p>${escapeHtml([source.creator, source.topic].filter(Boolean).join(' · ') || 'Creator and topic not recorded')}</p><div class="source-card-meta"><span class="chip">${source.segments.length} transcript segments</span><span class="chip">${activeInsights.length} insights</span><span class="chip">${activeInsights.filter((item) => item.status === 'connected').length} connected</span></div><div class="source-reader-actions"><a class="button button-accent" href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">Watch on YouTube ↗</a><button class="button button-danger" type="button" id="deleteSourceButton">Delete source</button></div></div>${insightSummary}<div class="source-reader-toolbar"><label class="search-field" for="transcriptSearch"><span aria-hidden="true">⌕</span><input id="transcriptSearch" type="search" placeholder="Search this transcript…" autocomplete="off"></label><span class="status-pill" id="transcriptResultCount"></span></div><div class="transcript-list" id="transcriptList"></div>`;
    openDialogNode(wrapper, {
      wide: true,
      onOpen: (panel) => {
        const renderSegments = () => {
          const search = $('#transcriptSearch', panel).value.trim().toLowerCase();
          const matching = source.segments.filter((segment) => segment.text.toLowerCase().includes(search));
          const visible = matching.slice(0, 750);
          $('#transcriptResultCount', panel).textContent = matching.length > visible.length ? `Showing ${visible.length} of ${matching.length}` : `${matching.length} segment${matching.length === 1 ? '' : 's'}`;
          $('#transcriptList', panel).innerHTML = visible.length ? visible.map((segment) => {
            const timestamp = segment.startSec !== null ? formatTimestamp(segment.startSec) : 'Text';
            const timeElement = segment.startSec !== null ? `<a class="segment-time" href="${escapeHtml(youtubeAt(source, segment.startSec))}" target="_blank" rel="noopener noreferrer" aria-label="Watch at ${escapeHtml(timestamp)}">${escapeHtml(timestamp)}</a>` : '<span class="segment-time">Text</span>';
            return `<article class="transcript-segment">${timeElement}<p>${escapeHtml(segment.text)}</p><button class="segment-insight-button" type="button" data-source-insight="${escapeHtml(segment.id)}">＋ Insight</button></article>`;
          }).join('') : emptyState('No transcript matches.', 'Try another search term.');
        };
        renderSegments();
        $$('[data-reader-connect]', panel).forEach((button) => button.addEventListener('click', () => openConnectInsight(button.dataset.readerConnect)));
        $('#transcriptSearch', panel).addEventListener('input', renderSegments);
        $('#transcriptList', panel).addEventListener('click', (event) => {
          const button = event.target.closest('[data-source-insight]');
          if (button) openInsightForm(source.id, button.dataset.sourceInsight);
        });
        $('#deleteSourceButton', panel).addEventListener('click', async () => {
          if (!confirm(`Delete “${source.title}” and all insights created from it? Connected technique text will remain.`)) return;
          state.sources = state.sources.filter((item) => item.id !== source.id);
          state.insights = state.insights.filter((item) => item.sourceId !== source.id);
          await save({ immediate: true });
          closeDialog();
          renderVault();
          toast('Film source deleted.');
        });
      }
    });
  };

  const openInsightForm = (sourceId, segmentId) => {
    const source = state.sources.find((item) => item.id === sourceId);
    const segment = source?.segments.find((item) => item.id === segmentId);
    if (!source || !segment) return;
    openTemplate('insightFormTemplate', {
      onOpen: (panel) => {
        const form = $('#insightForm', panel);
        form.elements.sourceId.value = source.id;
        form.elements.segmentId.value = segment.id;
        form.elements.timestampSec.value = segment.startSec ?? '';
        const words = segment.text.replace(/[.!?]+$/g, '').split(/\s+/).slice(0, 9).join(' ');
        form.elements.title.value = clean(words, 100);
        form.elements.body.value = clean(segment.text, 800);
        $('#insightSourceQuote', panel).innerHTML = `<strong>${escapeHtml(source.title)} · ${segment.startSec !== null ? escapeHtml(formatTimestamp(segment.startSec)) : 'Untimed'}</strong>${escapeHtml(segment.text)}`;
        $('#insightTechniqueSelect', panel).innerHTML = '<option value="">No suggested technique</option>' + state.techniques.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} · ${escapeHtml(item.category)}</option>`).join('');
        form.addEventListener('submit', async (event) => {
          event.preventDefault();
          const data = new FormData(form);
          const sourceIds = new Set(state.sources.map((item) => item.id));
          const techniqueIds = new Set(state.techniques.map((item) => item.id));
          const insight = normalizeInsight({
            id: uid('insight'), sourceId: source.id, segmentId: segment.id, type: data.get('type'), title: data.get('title'), body: data.get('body'),
            timestampSec: segment.startSec, status: 'inbox', techniqueId: data.get('techniqueId') || null, createdAt: nowIso(), updatedAt: nowIso()
          }, sourceIds, techniqueIds);
          state.insights.unshift(insight);
          await save({ immediate: true });
          closeDialog();
          view.vaultTab = 'film-study';
          renderVault();
          toast('Insight saved for approval.');
        });
      }
    });
  };

  const openConnectInsight = (id) => {
    const insight = state.insights.find((item) => item.id === id && item.status === 'inbox');
    const source = insight ? state.sources.find((item) => item.id === insight.sourceId) : null;
    if (!insight || !source) return;
    openTemplate('connectInsightTemplate', {
      onOpen: (panel) => {
        const form = $('#connectInsightForm', panel);
        form.elements.insightId.value = insight.id;
        $('#insightConnectPreview', panel).innerHTML = `<strong>${escapeHtml(insight.title)} · ${escapeHtml(insight.type)}</strong>${escapeHtml(insight.body)}<br><small>${escapeHtml(source.title)}${insight.timestampSec !== null ? ` · ${escapeHtml(formatTimestamp(insight.timestampSec))}` : ''}</small>`;
        $('#connectTechniqueSelect', panel).innerHTML = state.techniques.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} · ${escapeHtml(item.category)}</option>`).join('');
        if (insight.techniqueId && state.techniques.some((item) => item.id === insight.techniqueId)) form.elements.techniqueId.value = insight.techniqueId;
        if (!state.techniques.length) form.elements.action.value = 'new-technique';
        const updateConnectionFields = () => {
          const createsNew = form.elements.action.value === 'new-technique';
          $('#connectTechniqueField', panel).hidden = createsNew || form.elements.action.value === 'keep';
          $('#newTechniqueNameField', panel).hidden = !createsNew;
          if (createsNew) form.elements.newTechniqueName.value ||= insight.title;
        };
        updateConnectionFields();
        form.elements.action.addEventListener('change', updateConnectionFields);
        form.addEventListener('submit', async (event) => {
          event.preventDefault();
          const data = new FormData(form);
          const action = data.get('action');
          let technique = null;
          if (action === 'new-technique') {
            const name = clean(data.get('newTechniqueName') || insight.title, 80);
            if (!name) { toast('Name the new technique first.'); return; }
            technique = normalizeTechnique({ id: uid('tech'), name, category: 'Other', stance: state.profile.stance === 'Switch' ? 'Both' : state.profile.stance, confidence: 1, cue: insight.body, createdAt: nowIso(), updatedAt: nowIso(), schedule: normalizeSchedule() });
            state.techniques.unshift(technique);
          } else if (action !== 'keep') {
            technique = state.techniques.find((item) => item.id === data.get('techniqueId'));
            if (!technique) { toast('Choose a technique for this connection.'); return; }
          }
          if (technique) {
            if (action === 'coaching-point' && !technique.keys.includes(insight.body)) technique.keys.push(insight.body);
            if (action === 'primary-cue') {
              if (technique.cue && technique.cue !== insight.body && !technique.keys.includes(technique.cue)) technique.keys.unshift(technique.cue);
              technique.cue = insight.body;
            }
            if (action === 'notes') {
              const attribution = `${insight.body}\n— ${source.title}${insight.timestampSec !== null ? ` @ ${formatTimestamp(insight.timestampSec)}` : ''}`;
              technique.notes = clean([technique.notes, attribution].filter(Boolean).join('\n\n'), 2000);
            }
            technique.schedule.dueAt = nowIso();
            technique.updatedAt = nowIso();
          }
          insight.status = 'connected';
          insight.techniqueId = technique?.id || null;
          insight.connectionType = action;
          insight.updatedAt = nowIso();
          await save({ immediate: true });
          closeDialog();
          renderVault();
          renderToday();
          toast(technique ? `Insight connected to ${technique.name}.` : 'Insight approved in Film Study.');
        });
      }
    });
  };

  const dismissInsight = async (id) => {
    const insight = state.insights.find((item) => item.id === id);
    if (!insight) return;
    insight.status = 'dismissed';
    insight.updatedAt = nowIso();
    await save({ immediate: true });
    renderVault();
    toast('Insight dismissed.');
  };

  const openFocusDialog = () => {
    const wrapper = document.createElement('div');
    wrapper.className = 'dialog-form';
    wrapper.innerHTML = `<div class="dialog-head"><div><p class="micro-label">CURRENT FOCUS</p><h2>Keep one correction visible.</h2><p>This cue will lead the Today screen and smart-session suggestions.</p></div><button class="dialog-close" type="button" data-close-dialog aria-label="Close">×</button></div><div class="weak-list">${state.techniques.length ? state.techniques.map((item) => `<button class="weak-item" type="button" data-focus-id="${escapeHtml(item.id)}"><span class="category-mark">${categoryCode(item.category)}</span><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.cue || 'No cue saved')}</small></span><span>${state.preferences.focusTechniqueId === item.id ? '✓' : '›'}</span></button>`).join('') : '<p class="panel-footnote">Capture a technique first.</p>'}</div>`;
    openDialogNode(wrapper, {
      onOpen: (panel) => {
        $$('[data-focus-id]', panel).forEach((button) => button.addEventListener('click', async () => {
          state.preferences.focusTechniqueId = button.dataset.focusId;
          await save({ immediate: true });
          closeDialog();
          renderToday();
          toast('Current focus updated.');
        }));
      }
    });
  };

  const scheduleReview = (technique, grade) => {
    const schedule = technique.schedule;
    let interval = schedule.intervalDays || 0;
    let ease = schedule.ease || 2.3;
    if (grade === 'hard') {
      interval = 1;
      ease = Math.max(1.3, ease - 0.2);
      schedule.lapses += 1;
      technique.confidence = Math.max(1, technique.confidence - 1);
    } else if (grade === 'good') {
      interval = schedule.reps === 0 ? 1 : schedule.reps === 1 ? 3 : Math.max(2, Math.round(interval * ease));
      if (technique.confidence < 5 && schedule.reps > 0) technique.confidence += 1;
    } else {
      interval = schedule.reps === 0 ? 3 : schedule.reps === 1 ? 7 : Math.max(4, Math.round(interval * (ease + 0.35)));
      ease = Math.min(3.2, ease + 0.1);
      technique.confidence = Math.min(5, technique.confidence + 1);
    }
    schedule.intervalDays = interval;
    schedule.ease = ease;
    schedule.reps += 1;
    schedule.lastReviewedAt = nowIso();
    schedule.dueAt = addDays(new Date(), interval);
    technique.updatedAt = nowIso();
    state.reviewLog.push({ id: uid('review'), techniqueId: technique.id, grade, at: nowIso() });
    if (state.reviewLog.length > 5000) state.reviewLog = state.reviewLog.slice(-5000);
  };

  const renderCurrentReview = (panel) => {
    const id = view.reviewQueue[view.reviewIndex];
    const technique = state.techniques.find((item) => item.id === id);
    if (!technique) {
      closeDialog();
      return;
    }
    $('#reviewProgress', panel).textContent = `${view.reviewIndex + 1} of ${view.reviewQueue.length}`;
    $('#reviewCategory', panel).textContent = `${technique.category} · ${technique.stance}`;
    $('#reviewQuestion', panel).textContent = `What makes your ${technique.name} work?`;
    $('#reviewCue', panel).textContent = technique.cue || 'No coaching cue saved yet.';
    const linkedInsightAnswers = getTechniqueInsights(technique.id).map((insight) => insight.body);
    $('#reviewSteps', panel).innerHTML = [...new Set([...technique.keys, ...linkedInsightAnswers, ...technique.steps])].slice(0, 8).map((item) => `<li>${escapeHtml(item)}</li>`).join('') || '<li>Open this technique later and add the key steps.</li>';
    $('#memoryAnswer', panel).hidden = true;
    $('#showReviewAnswer', panel).hidden = false;
    $('#reviewGrades', panel).hidden = true;
  };

  const openReview = (ids = null) => {
    const queue = (ids || getDueTechniques().map((item) => item.id)).filter((id) => state.techniques.some((item) => item.id === id));
    if (!queue.length) {
      toast('Nothing is due right now. Your next smart session is ready.');
      return;
    }
    view.reviewQueue = queue;
    view.reviewIndex = 0;
    openTemplate('reviewTemplate', {
      wide: true,
      onOpen: (panel) => {
        renderCurrentReview(panel);
        $('#showReviewAnswer', panel).addEventListener('click', () => {
          $('#memoryAnswer', panel).hidden = false;
          $('#showReviewAnswer', panel).hidden = true;
          $('#reviewGrades', panel).hidden = false;
          $('[data-review-grade="good"]', panel)?.focus();
        });
        $('#reviewGrades', panel).addEventListener('click', async (event) => {
          const button = event.target.closest('[data-review-grade]');
          if (!button) return;
          const technique = state.techniques.find((item) => item.id === view.reviewQueue[view.reviewIndex]);
          if (technique) scheduleReview(technique, button.dataset.reviewGrade);
          view.reviewIndex += 1;
          await save({ immediate: true });
          if (view.reviewIndex >= view.reviewQueue.length) {
            closeDialog();
            updateAll();
            toast(`Review complete. ${view.reviewQueue.length} item${view.reviewQueue.length === 1 ? '' : 's'} rescheduled.`);
          } else {
            renderCurrentReview(panel);
          }
        });
      }
    });
  };

  const playBell = (frequency = 660, duration = 0.22) => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const context = playBell.context || (playBell.context = new AudioContext());
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, context.currentTime);
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.25, context.currentTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + duration + 0.02);
    } catch (_) { /* Sound is enhancement only. */ }
  };

  const speak = (text, cue = '') => {
    if (!state.preferences.training.voiceEnabled || !('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.92;
    utterance.pitch = 0.9;
    utterance.volume = 1;
    if (state.preferences.training.cueEnabled && cue) {
      utterance.onend = () => {
        const cueUtterance = new SpeechSynthesisUtterance(cue);
        cueUtterance.rate = 0.85;
        cueUtterance.pitch = 0.95;
        speechSynthesis.speak(cueUtterance);
      };
    }
    speechSynthesis.speak(utterance);
  };

  const refillPromptBag = () => {
    training.bag = [...training.pool];
    for (let index = training.bag.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [training.bag[index], training.bag[swap]] = [training.bag[swap], training.bag[index]];
    }
    if (training.bag.length > 1 && `${training.bag[training.bag.length - 1].type}:${training.bag[training.bag.length - 1].id}` === training.lastPromptKey) {
      [training.bag[0], training.bag[training.bag.length - 1]] = [training.bag[training.bag.length - 1], training.bag[0]];
    }
  };

  const nextTrainingPrompt = () => {
    if (training.status !== 'round') return;
    if (!training.bag.length) refillPromptBag();
    const prompt = training.bag.pop();
    if (!prompt) return;
    training.lastPromptKey = `${prompt.type}:${prompt.id}`;
    training.prompts.push({ type: prompt.type, id: prompt.id, at: nowIso() });
    $('#calloutContext').textContent = prompt.type === 'combo' ? (prompt.displayName || 'COMBINATION') : prompt.category;
    $('#stageCallout').textContent = prompt.name;
    const cue = prompt.cueOptions?.length ? prompt.cueOptions[Math.floor(Math.random() * prompt.cueOptions.length)] : prompt.cue;
    $('#stageCue').textContent = cue || (prompt.type === 'combo' ? 'Flow through the sequence, then reset cleanly.' : 'Stay balanced and return ready.');
    $('#stageCallout').animate?.([{ opacity: 0.25, transform: 'translateY(10px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 240, easing: 'ease-out' });
    speak(prompt.name, cue);
  };

  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) training.wakeLock = await navigator.wakeLock.request('screen');
    } catch (_) { /* Wake lock is enhancement only. */ }
  };

  const clearTrainingTimers = () => {
    window.clearInterval(training.tickTimer);
    window.clearInterval(training.promptTimer);
    training.tickTimer = 0;
    training.promptTimer = 0;
  };

  const startPromptTimer = () => {
    window.clearInterval(training.promptTimer);
    training.promptTimer = window.setInterval(nextTrainingPrompt, training.settings.promptInterval * 1000);
  };

  const setTrainingStage = (status) => {
    const stage = $('#trainingStage');
    stage.classList.toggle('active', status === 'round');
    stage.classList.toggle('resting', status === 'rest');
    $('#phaseLabel').textContent = status === 'round' ? 'ROUND ACTIVE' : status === 'rest' ? 'REST' : status === 'paused' ? 'PAUSED' : 'READY';
    $('#startSessionButton span:last-child').textContent = status === 'paused' ? 'Resume' : ['round', 'rest'].includes(status) ? 'Pause' : 'Start session';
    $('#startSessionButton span:first-child').textContent = ['round', 'rest'].includes(status) ? 'Ⅱ' : '▶';
    $('#skipPromptButton').disabled = status !== 'round';
    $('#endSessionButton').disabled = !['round', 'rest', 'paused'].includes(status);
    setBuilderDisabled(status !== 'idle');
  };

  const beginRound = () => {
    training.status = 'round';
    training.phaseEndsAt = Date.now() + (training.settings.roundLength * 1000);
    $('#roundCounter').textContent = `ROUND ${training.round} / ${training.settings.rounds}`;
    $('#stageTimer').textContent = formatDuration(training.settings.roundLength);
    $('#stageCallout').textContent = 'Hands up.';
    $('#stageCue').textContent = 'First callout incoming.';
    $('#calloutContext').textContent = 'WORK';
    setTrainingStage('round');
    playBell(760, 0.3);
    nextTrainingPrompt();
    startPromptTimer();
  };

  const beginRest = () => {
    training.status = 'rest';
    training.phaseEndsAt = Date.now() + (training.settings.restLength * 1000);
    window.clearInterval(training.promptTimer);
    speechSynthesis?.cancel?.();
    $('#calloutContext').textContent = `ROUND ${training.round} COMPLETE`;
    $('#stageCallout').textContent = 'Breathe. Reset.';
    $('#stageCue').textContent = `Round ${training.round + 1} is next.`;
    $('#stageTimer').textContent = formatDuration(training.settings.restLength);
    setTrainingStage('rest');
    playBell(480, 0.4);
  };

  const trainingTick = () => {
    if (!['round', 'rest'].includes(training.status)) return;
    const remaining = Math.max(0, Math.ceil((training.phaseEndsAt - Date.now()) / 1000));
    $('#stageTimer').textContent = formatDuration(remaining);
    if (remaining > 0) return;
    if (training.status === 'round') {
      if (training.round >= training.settings.rounds) finishTraining(false);
      else beginRest();
    } else {
      training.round += 1;
      beginRound();
    }
  };

  const startTraining = async () => {
    if (training.status === 'paused') {
      training.status = training.previousStatus;
      training.phaseEndsAt = Date.now() + training.pausedRemaining;
      setTrainingStage(training.status);
      if (training.status === 'round') startPromptTimer();
      speechSynthesis?.resume?.();
      return;
    }
    if (['round', 'rest'].includes(training.status)) {
      training.previousStatus = training.status;
      training.pausedRemaining = Math.max(0, training.phaseEndsAt - Date.now());
      training.status = 'paused';
      window.clearInterval(training.promptTimer);
      speechSynthesis?.pause?.();
      setTrainingStage('paused');
      $('#stageCallout').textContent = 'Session paused.';
      $('#stageCue').textContent = 'Resume when you are ready.';
      return;
    }
    const pool = buildTrainingPool();
    if (!pool.length) {
      toast('There is nothing to call out yet. Capture a technique first.');
      openQuickCapture();
      return;
    }
    training.settings = { ...state.preferences.training };
    training.pool = pool;
    training.bag = [];
    training.prompts = [];
    training.lastPromptKey = null;
    training.round = 1;
    training.startedAt = nowIso();
    training.draftSession = null;
    await requestWakeLock();
    clearTrainingTimers();
    training.tickTimer = window.setInterval(trainingTick, 250);
    beginRound();
  };

  const finishTraining = (early = false) => {
    if (!training.startedAt) return;
    clearTrainingTimers();
    speechSynthesis?.cancel?.();
    playBell(880, 0.5);
    const elapsed = Math.max(15, Math.round((Date.now() - dateValue(training.startedAt)) / 1000));
    const completedRounds = early ? Math.max(1, training.round - (training.status === 'rest' ? 0 : 1)) : training.settings.rounds;
    training.draftSession = normalizeSession({
      id: uid('session'), source: 'fight-vault', mode: training.settings.mode === 'smart' ? 'Smart session' : `${training.settings.mode} session`,
      startedAt: training.startedAt, completedAt: nowIso(), durationSec: Math.min(elapsed, (training.settings.rounds * training.settings.roundLength) + ((training.settings.rounds - 1) * training.settings.restLength)),
      rounds: completedRounds, techniqueIds: [...new Set(training.prompts.filter((item) => item.type === 'technique').map((item) => item.id))],
      comboIds: [...new Set(training.prompts.filter((item) => item.type === 'combo').map((item) => item.id))], prompts: training.prompts
    });
    training.draftSession.techniqueIds.forEach((id) => {
      const technique = state.techniques.find((item) => item.id === id);
      if (!technique) return;
      technique.trainingCount += 1;
      technique.lastTrainedAt = training.draftSession.completedAt;
      technique.updatedAt = training.draftSession.completedAt;
    });
    training.draftSession.comboIds.forEach((id) => {
      const combo = state.combos.find((item) => item.id === id);
      if (!combo) return;
      combo.trainingCount += 1;
      combo.lastTrainedAt = training.draftSession.completedAt;
      combo.updatedAt = training.draftSession.completedAt;
    });
    state.sessions.unshift(training.draftSession);
    save({ immediate: true });
    training.status = 'idle';
    training.startedAt = null;
    training.wakeLock?.release?.().catch(() => {});
    training.wakeLock = null;
    setTrainingStage('idle');
    $('#phaseLabel').textContent = 'COMPLETE';
    $('#stageCallout').textContent = 'Work logged.';
    $('#stageCue').textContent = 'One quick reflection will decide what comes back next.';
    $('#stageTimer').textContent = formatDuration(training.draftSession.durationSec);
    openReflection();
  };

  const openReflection = () => {
    if (!training.draftSession) return;
    openTemplate('reflectionTemplate', {
      onOpen: (panel) => {
        $('#reflectionForm', panel).addEventListener('submit', async (event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const feeling = data.get('feeling');
          const session = training.draftSession;
          session.feeling = feeling;
          session.reflection = { win: clean(data.get('win'), 400), improve: clean(data.get('improve'), 400) };
          session.techniqueIds.forEach((id) => {
            const technique = state.techniques.find((item) => item.id === id);
            if (!technique) return;
            if (feeling === 'hard') {
              technique.confidence = Math.max(1, technique.confidence - 1);
              technique.schedule.dueAt = addDays(new Date(), 1);
            } else if (feeling === 'sharp') {
              technique.confidence = Math.min(5, technique.confidence + 1);
              if (dateValue(technique.schedule.dueAt) < Date.now() + DAY) technique.schedule.dueAt = addDays(new Date(), 3);
            }
          });
          training.draftSession = null;
          await save({ immediate: true });
          closeDialog();
          updateAll();
          toast('Session saved. Tomorrow’s plan is updated.');
        });
      }
    });
  };

  const openExternalSession = () => {
    openTemplate('externalSessionTemplate', {
      onOpen: (panel) => {
        $('#externalSessionForm', panel).addEventListener('submit', async (event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          state.sessions.unshift(normalizeSession({
            id: uid('session'), source: 'external', mode: data.get('mode'), startedAt: nowIso(), completedAt: nowIso(),
            durationSec: Number(data.get('minutes')) * 60, focus: data.get('focus'), feeling: 'good',
            reflection: { win: data.get('win'), improve: data.get('improve') }
          }));
          await save({ immediate: true });
          closeDialog();
          renderProgress();
          renderToday();
          toast('Training session logged.');
        });
      }
    });
  };

  const openProfile = () => {
    openTemplate('profileTemplate', {
      onOpen: (panel) => {
        const form = $('#profileForm', panel);
        ['name', 'discipline', 'stance', 'goal'].forEach((key) => { form.elements[key].value = state.profile[key] || ''; });
        form.addEventListener('submit', async (event) => {
          event.preventDefault();
          const data = new FormData(form);
          state.profile.name = clean(data.get('name'), 40);
          state.profile.discipline = clean(data.get('discipline'), 40);
          state.profile.stance = clean(data.get('stance'), 20);
          state.profile.goal = clean(data.get('goal'), 20);
          await save({ immediate: true });
          closeDialog();
          renderToday();
          toast('Profile updated.');
        });
      }
    });
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ ...state, exportedAt: nowIso() }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `fight-vault-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Backup exported.');
  };

  const openDataSettings = () => {
    openTemplate('dataTemplate', {
      onOpen: (panel) => {
        $('#offlineStatus', panel).textContent = 'IndexedDB active' + ('serviceWorker' in navigator ? ' · App cache available' : '');
        $('#exportButton', panel).addEventListener('click', exportData);
        $('#importButton', panel).addEventListener('click', () => $('#importInput', panel).click());
        $('#importInput', panel).addEventListener('change', async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          try {
            const parsed = JSON.parse(await file.text());
            if (!Array.isArray(parsed.techniques) || !Array.isArray(parsed.combos) || !Array.isArray(parsed.sessions || parsed.journal || [])) throw new Error('Invalid Fight Vault backup');
            state = normalizeState(parsed);
            state.profile.onboardingComplete = true;
            await save({ immediate: true });
            closeDialog();
            updateAll();
            toast('Backup imported successfully.');
          } catch (error) {
            console.error(error);
            toast('That file is not a valid Fight Vault backup.');
          }
          event.target.value = '';
        });
        $('#resetButton', panel).addEventListener('click', async () => {
          if (!confirm('Delete every technique, combination, review, and session from this browser? This cannot be undone without a backup.')) return;
          state = blankState();
          await save({ immediate: true });
          closeDialog();
          updateAll();
          showOnboarding();
        });
      }
    });
  };

  let onboardingStep = 0;
  const showOnboarding = () => {
    onboardingStep = 0;
    updateOnboarding();
    const dialog = $('#onboardingDialog');
    if (!dialog.open) dialog.showModal();
  };
  const updateOnboarding = () => {
    $$('[data-onboarding-step]').forEach((section) => { section.hidden = Number(section.dataset.onboardingStep) !== onboardingStep; section.classList.toggle('active', Number(section.dataset.onboardingStep) === onboardingStep); });
    $$('.onboarding-progress i').forEach((item, index) => item.classList.toggle('active', index <= onboardingStep));
    $('#onboardingBack').hidden = onboardingStep === 0;
    $('#onboardingNext').textContent = onboardingStep === 0 ? 'Set up my vault' : onboardingStep === 1 ? 'Continue' : 'Enter Fight Vault';
  };
  const completeOnboarding = async () => {
    state.profile.onboardingComplete = true;
    state.profile.name = clean($('#onboardingName').value, 40);
    state.profile.discipline = clean($('#onboardingDiscipline').value, 40);
    state.profile.stance = clean($('#onboardingStance').value, 20);
    state.profile.goal = clean($('#onboardingGoal').value, 20);
    const name = clean($('#onboardingTechnique').value, 80);
    const cue = clean($('#onboardingCue').value, 300);
    if (name) {
      const technique = normalizeTechnique({ id: uid('tech'), name, cue, category: 'Other', stance: state.profile.stance === 'Switch' ? 'Both' : state.profile.stance, confidence: 2, createdAt: nowIso(), schedule: normalizeSchedule() });
      state.techniques.push(technique);
      state.preferences.focusTechniqueId = technique.id;
    }
    await save({ immediate: true });
    $('#onboardingDialog').close();
    updateAll();
    toast(name ? 'Your first coaching cue is ready to review.' : 'Your vault is ready. Capture a correction when you are ready.');
  };

  const bindStaticEvents = () => {
    window.addEventListener('hashchange', setRoute);
    $('#topCaptureButton').addEventListener('click', openQuickCapture);
    $('#heroCaptureButton').addEventListener('click', openQuickCapture);
    $('#vaultCaptureButton').addEventListener('click', openQuickCapture);
    $('#heroTrainButton').addEventListener('click', () => { location.hash = '#train'; });
    $('#newComboButton').addEventListener('click', () => openComboForm());
    $('#newFilmSourceButton').addEventListener('click', openFilmSourceForm);
    $('#filmImportButton').addEventListener('click', openFilmSourceForm);
    $('#reviewAllButton').addEventListener('click', () => openReview());
    $('#editFocusButton').addEventListener('click', openFocusDialog);
    $('#customizePlanButton').addEventListener('click', () => { location.hash = '#train'; });
    $('#logSessionButton').addEventListener('click', openExternalSession);
    $('#profileButton').addEventListener('click', openProfile);
    $('#dataButton').addEventListener('click', openDataSettings);
    $('#installButton').addEventListener('click', async () => {
      if (!view.deferredInstall) return;
      view.deferredInstall.prompt();
      await view.deferredInstall.userChoice;
      view.deferredInstall = null;
      $('#installButton').hidden = true;
    });
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      view.deferredInstall = event;
      $('#installButton').hidden = false;
    });

    $('#vaultTypeTabs').addEventListener('click', (event) => {
      const button = event.target.closest('[data-vault-tab]');
      if (!button) return;
      view.vaultTab = button.dataset.vaultTab;
      renderVault();
    });
    $('#vaultSearch').addEventListener('input', (event) => { view.search = event.target.value; renderVault(); });

    const trainingInputs = ['trainingMode', 'trainingCategory', 'roundCount', 'roundLength', 'restLength', 'promptInterval', 'voiceEnabled', 'cueEnabled', 'combosEnabled'];
    trainingInputs.forEach((id) => {
      $(`#${id}`).addEventListener(id === 'promptInterval' ? 'input' : 'change', (event) => {
        const map = {
          trainingMode: 'mode', trainingCategory: 'category', roundCount: 'rounds', roundLength: 'roundLength',
          restLength: 'restLength', promptInterval: 'promptInterval', voiceEnabled: 'voiceEnabled', cueEnabled: 'cueEnabled', combosEnabled: 'combosEnabled'
        };
        const key = map[id];
        state.preferences.training[key] = event.target.type === 'checkbox' ? event.target.checked : ['rounds', 'roundLength', 'restLength', 'promptInterval'].includes(key) ? Number(event.target.value) : event.target.value;
        save();
        renderTrainBuilder();
      });
    });
    $('#startSessionButton').addEventListener('click', startTraining);
    $('#skipPromptButton').addEventListener('click', nextTrainingPrompt);
    $('#endSessionButton').addEventListener('click', () => {
      if (confirm('End this session and save the work completed so far?')) finishTraining(true);
    });

    $('#modalLayer').addEventListener('click', (event) => { if (event.target === $('#modalLayer')) closeDialog(); });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && $('#modalLayer').classList.contains('open')) closeDialog();
      if (event.key === 'Enter' || event.key === ' ') {
        const card = event.target.closest('[role="button"][data-action]');
        if (card && event.target === card) { event.preventDefault(); card.click(); }
      }
      if (event.key === 'Tab' && $('#modalLayer').classList.contains('open')) {
        const focusable = $$('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]', $('#modalLayer')).filter((element) => element.offsetParent !== null);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });

    document.addEventListener('click', (event) => {
      const trigger = event.target.closest('[data-action]');
      if (!trigger) return;
      const action = trigger.dataset.action;
      if (action === 'capture') openQuickCapture();
      if (action === 'review') openReview();
      if (action === 'review-one') openReview([trigger.dataset.id]);
      if (action === 'train') location.hash = '#train';
      if (action === 'film-study') { view.vaultTab = 'film-study'; if (view.route === 'vault') renderVault(); else location.hash = '#vault'; }
      if (action === 'new-combo') openComboForm();
      if (action === 'new-source') openFilmSourceForm();
      if (action === 'edit-technique') openTechniqueForm(trigger.dataset.id);
      if (action === 'edit-combo') openComboForm(trigger.dataset.id);
      if (action === 'open-source') openSourceReader(trigger.dataset.id);
      if (action === 'connect-insight') openConnectInsight(trigger.dataset.id);
      if (action === 'dismiss-insight') dismissInsight(trigger.dataset.id);
      if (action === 'filter-category') { view.category = trigger.dataset.category; renderVault(); }
    });

    $('#onboardingNext').addEventListener('click', () => {
      if (onboardingStep === 1 && !$('#onboardingName').value.trim()) $('#onboardingName').value = 'Fighter';
      if (onboardingStep < 2) { onboardingStep += 1; updateOnboarding(); }
      else completeOnboarding();
    });
    $('#onboardingBack').addEventListener('click', () => { onboardingStep = Math.max(0, onboardingStep - 1); updateOnboarding(); });
    $('#onboardingDialog').addEventListener('cancel', (event) => event.preventDefault());

    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'visible' && ['round', 'rest'].includes(training.status)) {
        await requestWakeLock();
        trainingTick();
      }
    });
  };

  const registerServiceWorker = async () => {
    if (!('serviceWorker' in navigator) || !['http:', 'https:'].includes(location.protocol)) return;
    try {
      await navigator.serviceWorker.register('./sw.js', { scope: './' });
    } catch (error) {
      console.warn('Offline cache registration failed', error);
    }
  };

  const init = async () => {
    try {
      const stored = await dbRead(STATE_KEY);
      const legacy = stored ? null : readLegacyState();
      state = normalizeState(stored || legacy || blankState());
      if (legacy) await save({ immediate: true });
    } catch (error) {
      console.warn('IndexedDB unavailable, starting an in-memory session', error);
      state = normalizeState(readLegacyState() || blankState());
      markSaveState('Memory only');
    }
    bindStaticEvents();
    $('#appShell').hidden = false;
    $('#bottomNav').hidden = false;
    setRoute();
    updateAll();
    if (!state.profile.onboardingComplete) showOnboarding();
    registerServiceWorker();
  };

  init();
})();
