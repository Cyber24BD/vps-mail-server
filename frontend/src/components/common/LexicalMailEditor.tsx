import React, { useState, useEffect, useCallback, useRef } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { HeadingNode, QuoteNode, $createHeadingNode, $createQuoteNode } from '@lexical/rich-text';
import { ListItemNode, ListNode, INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND } from '@lexical/list';
import { LinkNode, AutoLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link';
import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html';
import {
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  FORMAT_ELEMENT_COMMAND,
  UNDO_COMMAND,
  REDO_COMMAND,
  $getRoot,
  $createParagraphNode,
  type EditorState,
  type LexicalEditor,
} from 'lexical';
import {
  Bold, Italic, Underline, Strikethrough, Heading1, Heading2,
  List, ListOrdered, Quote, Link2, AlignLeft, AlignCenter, AlignRight,
  Undo, Redo, Eye, FileCode, MousePointerClick, Minus,
} from 'lucide-react';

interface LexicalMailEditorProps {
  value: string;
  onChange: (html: string, text: string) => void;
  placeholder?: string;
  minHeight?: string;
}

// Lexical theme configuration for clean email styling
const editorTheme = {
  paragraph: 'lexical-paragraph',
  heading: {
    h1: 'lexical-h1',
    h2: 'lexical-h2',
    h3: 'lexical-h3',
  },
  quote: 'lexical-quote',
  list: {
    ul: 'lexical-ul',
    ol: 'lexical-ol',
    listitem: 'lexical-li',
  },
  text: {
    bold: 'lexical-bold',
    italic: 'lexical-italic',
    underline: 'lexical-underline',
    strikethrough: 'lexical-strikethrough',
    code: 'lexical-code',
  },
  link: 'lexical-link',
};

// Toolbar Plugin
const ToolbarPlugin: React.FC<{
  isSourceMode: boolean;
  onToggleSourceMode: () => void;
  onInsertTemplate: (templateType: string) => void;
}> = ({ isSourceMode, onToggleSourceMode, onInsertTemplate }) => {
  const [editor] = useLexicalComposerContext();
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);
  const [blockType, setBlockType] = useState('paragraph');

  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      setIsBold(selection.hasFormat('bold'));
      setIsItalic(selection.hasFormat('italic'));
      setIsUnderline(selection.hasFormat('underline'));
      setIsStrikethrough(selection.hasFormat('strikethrough'));

      const anchorNode = selection.anchor.getNode();
      const element = anchorNode.getKey() === 'root' ? anchorNode : anchorNode.getTopLevelElementOrThrow();
      const elementKey = element.getKey();
      const elementDOM = editor.getElementByKey(elementKey);

      if (elementDOM !== null) {
        const type = element.getType();
        if (type === 'heading') {
          const tag = (element as any).getTag();
          setBlockType(tag);
        } else {
          setBlockType(type);
        }
      }
    }
  }, [editor]);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }: { editorState: EditorState }) => {
      editorState.read(() => {
        updateToolbar();
      });
    });
  }, [editor, updateToolbar]);

  const formatHeading = (level: 'h1' | 'h2') => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        if (blockType === level) {
          const p = $createParagraphNode();
          selection.insertNodes([p]);
          setBlockType('paragraph');
        } else {
          const heading = $createHeadingNode(level);
          selection.insertNodes([heading]);
          setBlockType(level);
        }
      }
    });
  };

  const formatQuote = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const quote = $createQuoteNode();
        selection.insertNodes([quote]);
      }
    });
  };

  const insertLink = () => {
    const url = prompt('Enter link destination URL:', 'https://');
    if (url && url !== 'https://') {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
    }
  };

  const insertCtaButton = () => {
    const btnText = prompt('Enter button text:', 'Verify Account');
    if (!btnText) return;
    const btnUrl = prompt('Enter destination link URL:', 'https://');
    if (!btnUrl) return;

    editor.update(() => {
      const parser = new DOMParser();
      const dom = parser.parseFromString(
        `<p style="margin: 16px 0;"><a href="${btnUrl}" target="_blank" style="background-color: #111827; color: #FFFFFF; padding: 10px 20px; border-radius: 8px; font-weight: 600; font-size: 13px; text-decoration: none; display: inline-block;">${btnText}</a></p>`,
        'text/html'
      );
      const nodes = $generateNodesFromDOM(editor, dom);
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        selection.insertNodes(nodes);
      }
    });
  };

  const insertDivider = () => {
    editor.update(() => {
      const parser = new DOMParser();
      const dom = parser.parseFromString(
        '<hr style="border: 0; border-top: 1px solid #E5E7EB; margin: 20px 0;" />',
        'text/html'
      );
      const nodes = $generateNodesFromDOM(editor, dom);
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        selection.insertNodes(nodes);
      }
    });
  };

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '3px',
        padding: '6px 10px',
        backgroundColor: '#F8F9FA',
        borderBottom: '1px solid #E5E7EB',
      }}
    >
      {/* History */}
      <button
        type="button"
        className="btn-ghost"
        style={{ padding: '4px', height: '28px', width: '28px', borderRadius: '4px' }}
        onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
        title="Undo (Ctrl+Z)"
        disabled={isSourceMode}
      >
        <Undo size={14} />
      </button>
      <button
        type="button"
        className="btn-ghost"
        style={{ padding: '4px', height: '28px', width: '28px', borderRadius: '4px' }}
        onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
        title="Redo (Ctrl+Y)"
        disabled={isSourceMode}
      >
        <Redo size={14} />
      </button>

      <div style={{ width: '1px', height: '18px', backgroundColor: '#E5E7EB', margin: '0 4px' }} />

      {/* Headings */}
      <button
        type="button"
        className="btn-ghost"
        style={{
          padding: '4px',
          height: '28px',
          width: '28px',
          borderRadius: '4px',
          backgroundColor: blockType === 'h1' ? '#E9ECEF' : 'transparent',
        }}
        onClick={() => formatHeading('h1')}
        title="Heading 1"
        disabled={isSourceMode}
      >
        <Heading1 size={15} />
      </button>
      <button
        type="button"
        className="btn-ghost"
        style={{
          padding: '4px',
          height: '28px',
          width: '28px',
          borderRadius: '4px',
          backgroundColor: blockType === 'h2' ? '#E9ECEF' : 'transparent',
        }}
        onClick={() => formatHeading('h2')}
        title="Heading 2"
        disabled={isSourceMode}
      >
        <Heading2 size={15} />
      </button>

      <div style={{ width: '1px', height: '18px', backgroundColor: '#E5E7EB', margin: '0 4px' }} />

      {/* Text Formats */}
      <button
        type="button"
        className="btn-ghost"
        style={{
          padding: '4px',
          height: '28px',
          width: '28px',
          borderRadius: '4px',
          backgroundColor: isBold ? '#E9ECEF' : 'transparent',
        }}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}
        title="Bold (Ctrl+B)"
        disabled={isSourceMode}
      >
        <Bold size={14} />
      </button>
      <button
        type="button"
        className="btn-ghost"
        style={{
          padding: '4px',
          height: '28px',
          width: '28px',
          borderRadius: '4px',
          backgroundColor: isItalic ? '#E9ECEF' : 'transparent',
        }}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}
        title="Italic (Ctrl+I)"
        disabled={isSourceMode}
      >
        <Italic size={14} />
      </button>
      <button
        type="button"
        className="btn-ghost"
        style={{
          padding: '4px',
          height: '28px',
          width: '28px',
          borderRadius: '4px',
          backgroundColor: isUnderline ? '#E9ECEF' : 'transparent',
        }}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')}
        title="Underline (Ctrl+U)"
        disabled={isSourceMode}
      >
        <Underline size={14} />
      </button>
      <button
        type="button"
        className="btn-ghost"
        style={{
          padding: '4px',
          height: '28px',
          width: '28px',
          borderRadius: '4px',
          backgroundColor: isStrikethrough ? '#E9ECEF' : 'transparent',
        }}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough')}
        title="Strikethrough"
        disabled={isSourceMode}
      >
        <Strikethrough size={14} />
      </button>

      <div style={{ width: '1px', height: '18px', backgroundColor: '#E5E7EB', margin: '0 4px' }} />

      {/* Lists */}
      <button
        type="button"
        className="btn-ghost"
        style={{ padding: '4px', height: '28px', width: '28px', borderRadius: '4px' }}
        onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)}
        title="Bulleted List"
        disabled={isSourceMode}
      >
        <List size={15} />
      </button>
      <button
        type="button"
        className="btn-ghost"
        style={{ padding: '4px', height: '28px', width: '28px', borderRadius: '4px' }}
        onClick={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)}
        title="Numbered List"
        disabled={isSourceMode}
      >
        <ListOrdered size={15} />
      </button>
      <button
        type="button"
        className="btn-ghost"
        style={{ padding: '4px', height: '28px', width: '28px', borderRadius: '4px' }}
        onClick={formatQuote}
        title="Blockquote"
        disabled={isSourceMode}
      >
        <Quote size={14} />
      </button>

      <div style={{ width: '1px', height: '18px', backgroundColor: '#E5E7EB', margin: '0 4px' }} />

      {/* Alignment */}
      <button
        type="button"
        className="btn-ghost"
        style={{ padding: '4px', height: '28px', width: '28px', borderRadius: '4px' }}
        onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'left')}
        title="Align Left"
        disabled={isSourceMode}
      >
        <AlignLeft size={14} />
      </button>
      <button
        type="button"
        className="btn-ghost"
        style={{ padding: '4px', height: '28px', width: '28px', borderRadius: '4px' }}
        onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'center')}
        title="Align Center"
        disabled={isSourceMode}
      >
        <AlignCenter size={14} />
      </button>
      <button
        type="button"
        className="btn-ghost"
        style={{ padding: '4px', height: '28px', width: '28px', borderRadius: '4px' }}
        onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'right')}
        title="Align Right"
        disabled={isSourceMode}
      >
        <AlignRight size={14} />
      </button>

      <div style={{ width: '1px', height: '18px', backgroundColor: '#E5E7EB', margin: '0 4px' }} />

      {/* Advanced Email Design Helpers */}
      <button
        type="button"
        className="btn-ghost"
        style={{ padding: '4px', height: '28px', width: '28px', borderRadius: '4px' }}
        onClick={insertLink}
        title="Insert Link"
        disabled={isSourceMode}
      >
        <Link2 size={14} />
      </button>
      <button
        type="button"
        className="btn-ghost"
        style={{ padding: '4px 8px', height: '28px', borderRadius: '4px', fontSize: '11.5px', gap: '4px', display: 'flex', alignItems: 'center' }}
        onClick={insertCtaButton}
        title="Insert Call-to-Action Button"
        disabled={isSourceMode}
      >
        <MousePointerClick size={13} color="#2B8A3E" />
        <span>Button</span>
      </button>
      <button
        type="button"
        className="btn-ghost"
        style={{ padding: '4px 6px', height: '28px', borderRadius: '4px', fontSize: '11.5px', gap: '4px', display: 'flex', alignItems: 'center' }}
        onClick={insertDivider}
        title="Insert Divider Line"
        disabled={isSourceMode}
      >
        <Minus size={13} />
        <span>Line</span>
      </button>

      {/* Email Layout Templates Selector */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <select
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) {
              onInsertTemplate(e.target.value);
              e.target.value = '';
            }
          }}
          disabled={isSourceMode}
          style={{
            fontSize: '11.5px',
            height: '26px',
            padding: '0 6px',
            borderRadius: '6px',
            border: '1px solid #D1D5DB',
            backgroundColor: '#FFFFFF',
            cursor: 'pointer',
          }}
        >
          <option value="" disabled>Email Templates</option>
          <option value="corporate">Corporate Announcement</option>
          <option value="welcome">Welcome Onboarding</option>
          <option value="action">Action Required</option>
        </select>

        {/* Source Code Toggle */}
        <button
          type="button"
          className="btn-ghost"
          style={{
            padding: '4px 8px',
            height: '26px',
            borderRadius: '4px',
            fontSize: '11.5px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            backgroundColor: isSourceMode ? '#111827' : 'transparent',
            color: isSourceMode ? '#FFFFFF' : '#4B5563',
          }}
          onClick={onToggleSourceMode}
          title={isSourceMode ? 'Switch to Visual Lexical Editor' : 'Edit Raw HTML Code'}
        >
          {isSourceMode ? <Eye size={13} /> : <FileCode size={13} />}
          <span>{isSourceMode ? 'Visual Editor' : 'HTML Code'}</span>
        </button>
      </div>
    </div>
  );
};

// Initial HTML Hydration Plugin
const InitialHtmlPlugin: React.FC<{ initialHtml: string }> = ({ initialHtml }) => {
  const [editor] = useLexicalComposerContext();
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (!hydratedRef.current && initialHtml) {
      hydratedRef.current = true;
      editor.update(() => {
        const parser = new DOMParser();
        const dom = parser.parseFromString(initialHtml, 'text/html');
        const nodes = $generateNodesFromDOM(editor, dom);
        const root = $getRoot();
        root.clear();
        root.append(...nodes);
      });
    }
  }, [editor, initialHtml]);

  return null;
};

// Main Lexical Mail Editor Component
export const LexicalMailEditor: React.FC<LexicalMailEditorProps> = ({
  value,
  onChange,
  placeholder = 'Compose your message...',
  minHeight = '240px',
}) => {
  const [isSourceMode, setIsSourceMode] = useState(false);
  const [rawHtml, setRawHtml] = useState(value);
  const editorInstanceRef = useRef<LexicalEditor | null>(null);

  const initialConfig = {
    namespace: 'CorpMailEditor',
    theme: editorTheme,
    nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode, AutoLinkNode],
    onError: (error: Error) => {
      console.error('Lexical Error:', error);
    },
  };

  const handleEditorChange = (editorState: EditorState, editor: LexicalEditor) => {
    editorInstanceRef.current = editor;
    editorState.read(() => {
      const html = $generateHtmlFromNodes(editor);
      const text = $getRoot().getTextContent();
      setRawHtml(html);
      onChange(html, text);
    });
  };

  const handleSourceChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const html = e.target.value;
    setRawHtml(html);
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const text = tempDiv.innerText || '';
    onChange(html, text);
  };

  const handleToggleSourceMode = () => {
    if (isSourceMode) {
      // Switching from HTML to Visual: hydrate Lexical
      if (editorInstanceRef.current) {
        editorInstanceRef.current.update(() => {
          const parser = new DOMParser();
          const dom = parser.parseFromString(rawHtml, 'text/html');
          const nodes = $generateNodesFromDOM(editorInstanceRef.current!, dom);
          const root = $getRoot();
          root.clear();
          root.append(...nodes);
        });
      }
      setIsSourceMode(false);
    } else {
      setIsSourceMode(true);
    }
  };

  const handleInsertTemplate = (type: string) => {
    let tplHtml = '';
    if (type === 'corporate') {
      tplHtml = `
        <h2 style="color: #111827; font-size: 18px; margin-bottom: 8px;">Important Company Announcement</h2>
        <p style="color: #4B5563; line-height: 1.6;">Dear Team,</p>
        <p style="color: #4B5563; line-height: 1.6;">We are pleased to announce our latest updates regarding upcoming operations. Please review the key points outlined below.</p>
        <ul style="color: #4B5563; line-height: 1.6;">
          <li>Milestone deadline update</li>
          <li>Operational security guidelines</li>
          <li>System infrastructure transition</li>
        </ul>
        <p style="color: #4B5563; line-height: 1.6;">Thank you for your dedication and support.</p>
        <p style="color: #111827; font-weight: 600;">Best regards,<br/>Executive Management</p>
      `;
    } else if (type === 'welcome') {
      tplHtml = `
        <h2 style="color: #111827; font-size: 18px; margin-bottom: 8px;">Welcome to the Platform!</h2>
        <p style="color: #4B5563; line-height: 1.6;">Hello and welcome aboard! Your corporate mailbox is configured with end-to-end TLS encryption and high-speed delivery.</p>
        <p style="margin: 20px 0;"><a href="https://yourdomain.com" style="background-color: #1971C2; color: #FFFFFF; padding: 10px 22px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">Get Started Now</a></p>
        <p style="color: #6B7280; font-size: 12px;">If you have any questions, our support desk is always here to help.</p>
      `;
    } else if (type === 'action') {
      tplHtml = `
        <h2 style="color: #C92A2A; font-size: 18px; margin-bottom: 8px;">Action Required: Security Verification</h2>
        <p style="color: #4B5563; line-height: 1.6;">Please confirm the details of your recent account authorization within 24 hours.</p>
        <blockquote style="border-left: 3px solid #111827; padding-left: 12px; margin: 16px 0; color: #374151;">
          <strong>Request Reference:</strong> #SEC-9842<br/>
          <strong>Access Level:</strong> Corporate Administrator
        </blockquote>
        <p style="margin: 20px 0;"><a href="https://yourdomain.com" style="background-color: #111827; color: #FFFFFF; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">Confirm Verification</a></p>
      `;
    }

    if (tplHtml && editorInstanceRef.current) {
      editorInstanceRef.current.update(() => {
        const parser = new DOMParser();
        const dom = parser.parseFromString(tplHtml, 'text/html');
        const nodes = $generateNodesFromDOM(editorInstanceRef.current!, dom);
        const root = $getRoot();
        root.clear();
        root.append(...nodes);
      });
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
      <LexicalComposer initialConfig={initialConfig}>
        <ToolbarPlugin
          isSourceMode={isSourceMode}
          onToggleSourceMode={handleToggleSourceMode}
          onInsertTemplate={handleInsertTemplate}
        />

        <div style={{ position: 'relative', minHeight, display: 'flex', flexDirection: 'column' }}>
          {isSourceMode ? (
            <textarea
              value={rawHtml}
              onChange={handleSourceChange}
              style={{
                flex: 1,
                width: '100%',
                minHeight,
                padding: '14px 16px',
                fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                fontSize: '12.5px',
                lineHeight: 1.5,
                border: 'none',
                outline: 'none',
                resize: 'vertical',
                backgroundColor: '#1E1E1E',
                color: '#D4D4D4',
                boxSizing: 'border-box',
              }}
              placeholder="<!-- Write or paste raw HTML code here -->"
            />
          ) : (
            <>
              <RichTextPlugin
                contentEditable={
                  <ContentEditable
                    style={{
                      flex: 1,
                      minHeight,
                      padding: '14px 16px',
                      outline: 'none',
                      fontSize: '13.5px',
                      lineHeight: 1.6,
                      color: '#1F2937',
                    }}
                  />
                }
                placeholder={
                  <div
                    style={{
                      position: 'absolute',
                      top: '14px',
                      left: '16px',
                      color: '#9CA3AF',
                      pointerEvents: 'none',
                      fontSize: '13.5px',
                    }}
                  >
                    {placeholder}
                  </div>
                }
                ErrorBoundary={LexicalErrorBoundary}
              />
              <HistoryPlugin />
              <ListPlugin />
              <LinkPlugin />
              <InitialHtmlPlugin initialHtml={value} />
              <OnChangePlugin onChange={handleEditorChange} />
            </>
          )}
        </div>
      </LexicalComposer>

      {/* Editor CSS styles for rich text nodes */}
      <style>{`
        .lexical-paragraph { margin: 0 0 10px 0; }
        .lexical-h1 { font-size: 20px; font-weight: 700; margin: 14px 0 8px 0; color: #111827; }
        .lexical-h2 { font-size: 17px; font-weight: 700; margin: 12px 0 6px 0; color: #111827; }
        .lexical-h3 { font-size: 15px; font-weight: 600; margin: 10px 0 4px 0; color: #111827; }
        .lexical-quote { border-left: 3px solid #2D3139; padding-left: 12px; margin: 12px 0; color: #4B5563; font-style: italic; }
        .lexical-ul { padding-left: 24px; margin: 8px 0; list-style-type: disc; }
        .lexical-ol { padding-left: 24px; margin: 8px 0; list-style-type: decimal; }
        .lexical-li { margin: 3px 0; }
        .lexical-bold { font-weight: 700; }
        .lexical-italic { font-style: italic; }
        .lexical-underline { text-decoration: underline; }
        .lexical-strikethrough { text-decoration: line-through; }
        .lexical-code { font-family: monospace; background-color: #F3F4F6; padding: 2px 4px; border-radius: 4px; font-size: 12px; }
        .lexical-link { color: #1971C2; text-decoration: underline; }
      `}</style>
    </div>
  );
};
export default LexicalMailEditor;
