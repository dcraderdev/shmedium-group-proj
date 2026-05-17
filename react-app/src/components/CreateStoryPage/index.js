import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useHistory, useParams, useLocation } from 'react-router-dom';
import './CreateStoryPage.css';
import * as storyActions from '../../store/story';
import { initialLoad } from '../../store/story';
import RichTextBlock from '../RichTextBlock';

/* ─── PublishModal ─────────────────────────────────────────────── */

function PublishModal({ draftId, title, content, allTags, onClose, onPublished }) {
  const dispatch = useDispatch();
  const [selectedTags, setSelectedTags] = useState([]);
  const [summary, setSummary] = useState(content.replace(/<[^>]+>/g, '').slice(0, 140));
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');

  const toggleTag = (tagStr) => {
    setSelectedTags((prev) =>
      prev.includes(tagStr) ? prev.filter((t) => t !== tagStr) : [...prev, tagStr]
    );
  };

  const handleCover = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setCoverFile(f);
    setCoverPreview(URL.createObjectURL(f));
  };

  const handlePublish = async () => {
    if (!title.trim()) { setError('A title is required to publish.'); return; }
    setPublishing(true);
    setError('');

    const fd = new FormData();
    fd.append('title', title.trim());
    fd.append('content', content);
    fd.append('slicedIntro', summary.slice(0, 140));
    selectedTags.forEach((tagStr) => fd.append('tags', tagStr));
    if (coverFile) {
      fd.append('images', coverFile);
      fd.append('position0', 0);
      fd.append('altTag0', 'Cover image');
    }

    const result = await dispatch(storyActions.publishStory(draftId, fd));
    setPublishing(false);
    if (result && result.id) {
      onPublished(result.id);
    } else {
      setError('Publish failed. Please try again.');
    }
  };

  return (
    <div className="pub-overlay" onClick={onClose}>
      <div className="pub-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pub-modal-header">
          <span className="pub-modal-title">Ready to publish?</span>
          <button className="pub-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="pub-two-col">
          {/* Left: cover preview */}
          <div className="pub-cover-col">
            <label className="pub-section-label">Story preview</label>
            <div className="pub-cover-zone" style={coverPreview ? { backgroundImage: `url(${coverPreview})` } : {}}>
              {!coverPreview && <span className="pub-cover-placeholder">No cover image</span>}
            </div>
            <label className="pub-cover-btn">
              {coverPreview ? 'Change image' : 'Add cover image'}
              <input type="file" accept="image/*" onChange={handleCover} style={{ display: 'none' }} />
            </label>

            <label className="pub-section-label pub-summary-label">Story summary</label>
            <textarea
              className="pub-summary-input"
              value={summary}
              onChange={(e) => setSummary(e.target.value.slice(0, 140))}
              placeholder="Write a brief description of your story…"
              rows={3}
            />
            <span className="pub-char-count">{summary.length}/140</span>
          </div>

          {/* Right: tags */}
          <div className="pub-tags-col">
            <label className="pub-section-label">Add topics (up to 5)</label>
            <p className="pub-tags-hint">Let readers know what your story is about</p>
            <div className="pub-tags-grid">
              {allTags.map((tagStr) => {
                const active = selectedTags.includes(tagStr);
                return (
                  <button
                    key={tagStr}
                    type="button"
                    className={`pub-tag ${active ? 'pub-tag-active' : ''}`}
                    onClick={() => (selectedTags.length < 5 || active) ? toggleTag(tagStr) : null}
                  >
                    {tagStr}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {error && <p className="pub-error">{error}</p>}

        <div className="pub-footer">
          <button className="pub-cancel-btn" onClick={onClose} disabled={publishing}>Cancel</button>
          <button className="pub-submit-btn" onClick={handlePublish} disabled={publishing}>
            {publishing ? 'Publishing…' : 'Publish now'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── CreateStoryPage ──────────────────────────────────────────── */

const AUTOSAVE_INTERVAL = 30_000;

const CreateStoryPage = () => {
  const location = useLocation();
  const dispatch = useDispatch();
  const history = useHistory();
  const { id } = useParams();
  const fileInputRef = useRef(null);

  const user = useSelector((state) => state.session.user);
  const allTags = useSelector((state) => state.story.tags);
  const currentStory = useSelector((state) => state.story.currentStory);

  const [blocks, setBlocks] = useState([]);
  const [titleText, setTitleText] = useState('');
  const [imagesToUpdate, setImagesToUpdate] = useState({});
  const [draftId, setDraftId] = useState(null);
  const [saveStatus, setSaveStatus] = useState(''); // '' | 'saving' | 'saved' | 'error'
  const [lastSaved, setLastSaved] = useState(null);
  const [showPublishModal, setShowPublishModal] = useState(false);

  const isEditing = location.pathname === `/create/${id}/edit`;

  // Redirect if not logged in
  useEffect(() => {
    if (!user) history.push('/home');
  }, [user]);

  // Ensure tags are loaded for the publish modal
  useEffect(() => {
    if (allTags.length === 0) dispatch(initialLoad());
  }, []);

  // Load existing story when editing
  useEffect(() => {
    if (isEditing && id) {
      dispatch(storyActions.getStoryById(id));
    }
  }, [id]);

  // Reset on route change
  useEffect(() => {
    setBlocks([]);
    setTitleText('');
    setDraftId(null);
    setSaveStatus('');
    setLastSaved(null);
  }, [location.pathname]);

  // Populate blocks from loaded story
  useEffect(() => {
    if (!isEditing || !currentStory) return;
    if (currentStory.authorId !== user?.id) { history.push('/create'); return; }

    setTitleText(currentStory.title || '');
    setDraftId(currentStory.id);

    const updatedImages = {};
    let lastPos = 0;
    const blocksTemp = [];

    currentStory.images.forEach((image) => {
      updatedImages[image.id] = image;
      const text = currentStory.content.slice(lastPos, image.position);
      if (image.position > 0) blocksTemp.push({ type: 'text', content: text });
      blocksTemp.push({ type: 'awsimage', content: image.url, altTag: image.altTag, id: image.id, position: image.position, variants: image.variants || null });
      lastPos = image.position;
    });

    if (lastPos < currentStory.content.length) {
      blocksTemp.push({ type: 'text', content: currentStory.content.slice(lastPos) });
    }

    setImagesToUpdate(updatedImages);
    setBlocks(blocksTemp);
  }, [currentStory]);

  /* ── Autosave ── */

  const buildContent = useCallback(() => {
    let content = '';
    blocks.forEach((b) => { if (b.type === 'text') content += b.content; });
    return content;
  }, [blocks]);

  const doAutosave = useCallback(async (idToSave, currentTitle, currentContent) => {
    if (!idToSave) return;
    setSaveStatus('saving');
    const result = await dispatch(storyActions.autosaveStory(idToSave, currentTitle, currentContent));
    if (result?.savedAt) {
      setSaveStatus('saved');
      setLastSaved(new Date());
    } else {
      setSaveStatus('error');
    }
  }, [dispatch]);

  // Ensure a draft exists before autosaving new stories
  const ensureDraft = useCallback(async () => {
    if (draftId) return draftId;
    const result = await dispatch(storyActions.createDraft());
    if (result?.id) {
      setDraftId(result.id);
      return result.id;
    }
    return null;
  }, [draftId, dispatch]);

  // 30s autosave timer
  useEffect(() => {
    const timer = setInterval(async () => {
      const content = buildContent();
      if (!titleText && !content) return;
      const id = await ensureDraft();
      await doAutosave(id, titleText, content);
    }, AUTOSAVE_INTERVAL);
    return () => clearInterval(timer);
  }, [titleText, buildContent, ensureDraft, doAutosave]);

  /* ── Manual save draft ── */

  const handleSaveDraft = async () => {
    const content = buildContent();
    const id = await ensureDraft();
    await doAutosave(id, titleText, content);
  };

  /* ── Block management ── */

  const addBlock = (type) => {
    if (type === 'image') { fileInputRef.current.click(); return; }
    setBlocks((prev) => [...prev, { type: 'text', content: '' }]);
    setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 200);
  };

  const deleteBlock = (index) => {
    const b = blocks[index];
    if (imagesToUpdate[b?.id]) {
      const updated = { ...imagesToUpdate };
      delete updated[b.id];
      setImagesToUpdate(updated);
    }
    setBlocks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const ts = Date.now();
    const parts = file.name.split('.');
    const ext = parts.pop();
    const newFile = new File([file], `${parts.join('.')}_${ts}.${ext}`, { type: file.type });
    setBlocks((prev) => [...prev, { type: 'image', content: newFile, altTag: '' }]);
    setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 200);
    e.target.value = null;
  };

  /* ── Publish ── */

  const hasContent = titleText.trim() && blocks.some((b) => b.type === 'text' && b.content.trim());

  const handlePublishClick = async () => {
    if (!hasContent) return;
    const content = buildContent();
    const id = await ensureDraft();
    // Autosave first so the server has the latest content
    await doAutosave(id, titleText, content);
    setShowPublishModal(true);
  };

  const handlePublished = (storyId) => {
    setShowPublishModal(false);
    history.push(`/story/${storyId}`);
  };

  /* ── Status label ── */

  const statusLabel = (() => {
    if (saveStatus === 'saving') return 'Saving…';
    if (saveStatus === 'error') return 'Save failed';
    if (saveStatus === 'saved' && lastSaved) {
      const mins = Math.round((Date.now() - lastSaved) / 60000);
      return mins < 1 ? 'Draft saved' : `Saved ${mins}m ago`;
    }
    return '';
  })();

  /* ── Render ── */

  return (
    <div className="createstory-container">
      {/* Top toolbar */}
      <div className="csp-toolbar">
        <div className="csp-status">{statusLabel}</div>
        <div className="csp-toolbar-right">
          <button className="csp-save-btn" onClick={handleSaveDraft} title="Save draft">
            Save draft
          </button>
          <button
            className={`csp-publish-btn ${!hasContent ? 'disabled' : ''}`}
            onClick={handlePublishClick}
            disabled={!hasContent}
          >
            Publish
          </button>
        </div>
      </div>

      <form className="article-container" onSubmit={(e) => e.preventDefault()}>
        <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={handleFileSelect} />

        {/* Title */}
        <div className="title-input-container">
          <input
            className="title-input header-text"
            type="text"
            value={titleText}
            onChange={(e) => setTitleText(e.target.value)}
            placeholder="Title"
          />
        </div>

        {/* Blocks */}
        {blocks.map((block, index) => {
          if (block.type === 'text') {
            return (
              <div className="text-wrapper" key={index}>
                <button type="button" className="delete-button" onClick={() => deleteBlock(index)} title="Remove block">×</button>
                <div className="text-container memo-text">
                  <RichTextBlock
                    initialContent={block.content}
                    onChange={(value) => {
                      setBlocks((prev) => { const n = [...prev]; n[index] = { ...n[index], content: value }; return n; });
                    }}
                    placeholder="Tell your story…"
                  />
                </div>
              </div>
            );
          }

          if (block.type === 'image') {
            return (
              <div className="image-wrapper" key={index}>
                <button type="button" className="delete-button" onClick={() => deleteBlock(index)} title="Remove image">×</button>
                <div className="image-container">
                  {block.content && <img className="story-image" src={URL.createObjectURL(block.content)} alt="" />}
                  <input
                    className="alt-text-input"
                    value={block.altTag}
                    onChange={(e) => setBlocks((prev) => { const n = [...prev]; n[index] = { ...n[index], altTag: e.target.value }; return n; })}
                    placeholder="Add alt text"
                  />
                </div>
              </div>
            );
          }

          if (block.type === 'awsimage') {
            return (
              <div className="image-wrapper" key={index}>
                <button type="button" className="delete-button" onClick={() => deleteBlock(index)} title="Remove image">×</button>
                <div className="image-container">
                  {block.content && (
                    block.variants ? (
                      <picture>
                        <source type="image/webp" srcSet={`${block.variants.thumbnail?.webp} 400w, ${block.variants.card?.webp} 800w`} sizes="(max-width: 700px) 400px, 800px" />
                        <img className="story-image" src={block.variants.card?.jpeg || block.content} alt={block.altTag} loading="lazy" decoding="async" />
                      </picture>
                    ) : (
                      <img className="story-image" src={block.content} alt={block.altTag} loading="lazy" decoding="async" />
                    )
                  )}
                  <input
                    className="alt-text-input"
                    value={block.altTag}
                    onChange={(e) => setBlocks((prev) => { const n = [...prev]; n[index] = { ...n[index], altTag: e.target.value }; return n; })}
                    placeholder="Add alt text"
                  />
                </div>
              </div>
            );
          }

          return null;
        })}

        {/* Add content buttons */}
        <div className="createstorypage-buttons-container">
          <div className="createstorypage-add-content-button">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </div>
          {(blocks.length === 0 || blocks[blocks.length - 1]?.type !== 'text') && (
            <button type="button" className="add-button" onClick={() => addBlock('text')} title="Add text block">
              <i className="fa-solid fa-font" />
            </button>
          )}
          <button type="button" className="add-button" onClick={() => addBlock('image')} title="Add image">
            <i className="fa-solid fa-camera" />
          </button>
        </div>
      </form>

      {showPublishModal && (
        <PublishModal
          draftId={draftId}
          title={titleText}
          content={buildContent()}
          allTags={allTags}
          onClose={() => setShowPublishModal(false)}
          onPublished={handlePublished}
        />
      )}
    </div>
  );
};

export default CreateStoryPage;
