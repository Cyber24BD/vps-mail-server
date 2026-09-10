import React, { useRef, useState, useEffect } from 'react';
import {
  Bold, Italic, Underline, Strikethrough, Heading1, Heading2,
  List, ListOrdered, Quote, Link2, RemoveFormatting, Eye, FileCode
} from 'lucide-react';

interface HtmlEditorProps {
  value: string;
  onChange: (html: string, text: string) => void;
  placeholder?: string;
  minHeight?: string;
}

export const HtmlEditor: React.FC<HtmlEditorProps> = ({
  value,
  onChange,
  placeholder = 'Compose your message...',
  minHeight = '220px',
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isSourceMode, setIsSourceMode] = useState(false);
  const [htmlContent, setHtmlContent] = useState(value);

  // Sync external value changes to editor when not focused
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
      setHtmlContent(value);
    }
  }, [value]);

  const executeCommand = (command: string, arg: string | undefined = undefined) => {
    document.execCommand(command, false, arg);
    handleEditorInput();
  };

  const handleEditorInput = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      const text = editorRef.current.innerText || '';
      setHtmlContent(html);
      onChange(html, text);
    }
  };

  const handleSourceChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const html = e.target.value;
    setHtmlContent(html);
    // Simple tag stripper for plain text
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const text = tempDiv.innerText || '';
    onChange(html, text);
  };

  const insertLink = () => {
    const url = prompt('Enter destination URL:', 'https://');
    if (url && url !== 'https://') {
      executeCommand('createLink', url);
    }
  };

  return (
    <div
      style={{
        border: '1px solid #D1D5DB',
        borderRadius: '8px',
        overflow: 'hidden',
        backgroundColor: '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '2px',
          padding: '6px 8px',
          backgroundColor: '#F8F9FA',
          borderBottom: '1px solid #E5E7EB',
        }}
      >
        <button
          type="button"
          className="btn-ghost"
          style={{ padding: '4px', height: '28px', width: '28px', borderRadius: '4px' }}
          onClick={() => executeCommand('bold')}
          title="Bold (Ctrl+B)"
          disabled={isSourceMode}
        >
          <Bold size={15} strokeWidth={2} />
        </button>
        <button
          type="button"
          className="btn-ghost"
          style={{ padding: '4px', height: '28px', width: '28px', borderRadius: '4px' }}
          onClick={() => executeCommand('italic')}
          title="Italic (Ctrl+I)"
          disabled={isSourceMode}
        >
          <Italic size={15} strokeWidth={2} />
        </button>
        <button
          type="button"
          className="btn-ghost"
          style={{ padding: '4px', height: '28px', width: '28px', borderRadius: '4px' }}
          onClick={() => executeCommand('underline')}
          title="Underline (Ctrl+U)"
          disabled={isSourceMode}
        >
          <Underline size={15} strokeWidth={2} />
        </button>
        <button
          type="button"
          className="btn-ghost"
          style={{ padding: '4px', height: '28px', width: '28px', borderRadius: '4px' }}
          onClick={() => executeCommand('strikeThrough')}
          title="Strikethrough"
          disabled={isSourceMode}
        >
          <Strikethrough size={15} strokeWidth={2} />
        </button>

        <div style={{ width: '1px', height: '18px', backgroundColor: '#E5E7EB', margin: '0 4px' }} />

        <button
          type="button"
          className="btn-ghost"
          style={{ padding: '4px', height: '28px', width: '28px', borderRadius: '4px' }}
          onClick={() => executeCommand('formatBlock', '<h1>')}
          title="Heading 1"
          disabled={isSourceMode}
        >
          <Heading1 size={15} strokeWidth={2} />
        </button>
        <button
          type="button"
          className="btn-ghost"
          style={{ padding: '4px', height: '28px', width: '28px', borderRadius: '4px' }}
          onClick={() => executeCommand('formatBlock', '<h2>')}
          title="Heading 2"
          disabled={isSourceMode}
        >
          <Heading2 size={15} strokeWidth={2} />
        </button>

        <div style={{ width: '1px', height: '18px', backgroundColor: '#E5E7EB', margin: '0 4px' }} />

        <button
          type="button"
          className="btn-ghost"
          style={{ padding: '4px', height: '28px', width: '28px', borderRadius: '4px' }}
          onClick={() => executeCommand('insertUnorderedList')}
          title="Bullet List"
          disabled={isSourceMode}
        >
          <List size={15} strokeWidth={2} />
        </button>
        <button
          type="button"
          className="btn-ghost"
          style={{ padding: '4px', height: '28px', width: '28px', borderRadius: '4px' }}
          onClick={() => executeCommand('insertOrderedList')}
          title="Numbered List"
          disabled={isSourceMode}
        >
          <ListOrdered size={15} strokeWidth={2} />
        </button>
        <button
          type="button"
          className="btn-ghost"
          style={{ padding: '4px', height: '28px', width: '28px', borderRadius: '4px' }}
          onClick={() => executeCommand('formatBlock', '<blockquote>')}
          title="Quote"
          disabled={isSourceMode}
        >
          <Quote size={15} strokeWidth={2} />
        </button>

        <div style={{ width: '1px', height: '18px', backgroundColor: '#E5E7EB', margin: '0 4px' }} />

        <button
          type="button"
          className="btn-ghost"
          style={{ padding: '4px', height: '28px', width: '28px', borderRadius: '4px' }}
          onClick={insertLink}
          title="Insert Link"
          disabled={isSourceMode}
        >
          <Link2 size={15} strokeWidth={2} />
        </button>
        <button
          type="button"
          className="btn-ghost"
          style={{ padding: '4px', height: '28px', width: '28px', borderRadius: '4px' }}
          onClick={() => executeCommand('removeFormat')}
          title="Clear Formatting"
          disabled={isSourceMode}
        >
          <RemoveFormatting size={15} strokeWidth={2} />
        </button>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            type="button"
            className="btn-ghost"
            style={{
              padding: '3px 8px',
              height: '26px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 600,
              backgroundColor: isSourceMode ? '#111827' : 'transparent',
              color: isSourceMode ? '#FFFFFF' : '#4B5563',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            onClick={() => setIsSourceMode(!isSourceMode)}
            title="Toggle HTML Source Mode"
          >
            {isSourceMode ? <Eye size={13} /> : <FileCode size={13} />}
            <span>{isSourceMode ? 'Visual' : 'HTML'}</span>
          </button>
        </div>
      </div>

      {/* Editor Body */}
      {isSourceMode ? (
        <textarea
          value={htmlContent}
          onChange={handleSourceChange}
          style={{
            width: '100%',
            minHeight,
            padding: '12px 14px',
            border: 'none',
            outline: 'none',
            fontFamily: 'JetBrains Mono, Menlo, monospace',
            fontSize: '12.5px',
            lineHeight: 1.5,
            color: '#1F2937',
            backgroundColor: '#FAFAFA',
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
          placeholder="Enter raw HTML email template code..."
        />
      ) : (
        <div
          ref={editorRef}
          contentEditable
          onInput={handleEditorInput}
          onBlur={handleEditorInput}
          style={{
            minHeight,
            padding: '14px 16px',
            outline: 'none',
            fontSize: '14px',
            lineHeight: 1.6,
            color: '#111827',
            overflowY: 'auto',
            boxSizing: 'border-box',
          }}
          data-placeholder={placeholder}
        />
      )}
    </div>
  );
};
