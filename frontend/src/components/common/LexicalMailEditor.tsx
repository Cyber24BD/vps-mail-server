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
  $isElementNode,
  $isDecoratorNode,
  ParagraphNode,
  type EditorState,
  type LexicalEditor,
} from 'lexical';
import {
  Bold, Italic, Underline, Strikethrough, Code,
  Heading1, Heading2, Quote,
  List, ListOrdered,
  Link2, AlignLeft, AlignCenter, AlignRight,
  Undo2, Redo2, Eye, Code2, MousePointerClick, Minus,
  LayoutTemplate,
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
  const [isCode, setIsCode] = useState(false);
  const [blockType, setBlockType] = useState('paragraph');

  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      setIsBold(selection.hasFormat('bold'));
      setIsItalic(selection.hasFormat('italic'));
      setIsUnderline(selection.hasFormat('underline'));
      setIsStrikethrough(selection.hasFormat('strikethrough'));
      setIsCode(selection.hasFormat('code'));

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
        if (blockType === 'quote') {
          const p = $createParagraphNode();
          selection.insertNodes([p]);
          setBlockType('paragraph');
        } else {
          const quote = $createQuoteNode();
          selection.insertNodes([quote]);
          setBlockType('quote');
        }
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
    const btnText = prompt('Enter button text:', 'Get Started');
    if (!btnText) return;
    const btnUrl = prompt('Enter button destination link URL:', 'https://');
    if (!btnUrl) return;

    editor.update(() => {
      const parser = new DOMParser();
      const dom = parser.parseFromString(
        `<p style="margin: 20px 0;"><a href="${btnUrl}" target="_blank" style="background-color: #111827; color: #FFFFFF; padding: 10px 22px; border-radius: 6px; font-weight: 600; font-size: 13px; text-decoration: none; display: inline-block; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">${btnText}</a></p>`,
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
        '<hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />',
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
    <div className="lex-toolbar">
      {/* Primary Tool Group */}
      <div className="lex-toolbar-group">
        {/* Undo / Redo */}
        <button
          type="button"
          className="lex-btn"
          onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
          title="Undo (Ctrl+Z)"
          disabled={isSourceMode}
        >
          <Undo2 size={14} />
        </button>
        <button
          type="button"
          className="lex-btn"
          onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
          title="Redo (Ctrl+Y)"
          disabled={isSourceMode}
        >
          <Redo2 size={14} />
        </button>

        <div className="lex-divider" />

        {/* Headings & Quote */}
        <button
          type="button"
          className={`lex-btn ${blockType === 'h1' ? 'active' : ''}`}
          onClick={() => formatHeading('h1')}
          title="Heading 1"
          disabled={isSourceMode}
        >
          <Heading1 size={15} />
        </button>
        <button
          type="button"
          className={`lex-btn ${blockType === 'h2' ? 'active' : ''}`}
          onClick={() => formatHeading('h2')}
          title="Heading 2"
          disabled={isSourceMode}
        >
          <Heading2 size={15} />
        </button>
        <button
          type="button"
          className={`lex-btn ${blockType === 'quote' ? 'active' : ''}`}
          onClick={formatQuote}
          title="Blockquote"
          disabled={isSourceMode}
        >
          <Quote size={13} />
        </button>

        <div className="lex-divider" />

        {/* Inline Formatting */}
        <button
          type="button"
          className={`lex-btn ${isBold ? 'active' : ''}`}
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}
          title="Bold (Ctrl+B)"
          disabled={isSourceMode}
        >
          <Bold size={14} />
        </button>
        <button
          type="button"
          className={`lex-btn ${isItalic ? 'active' : ''}`}
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}
          title="Italic (Ctrl+I)"
          disabled={isSourceMode}
        >
          <Italic size={14} />
        </button>
        <button
          type="button"
          className={`lex-btn ${isUnderline ? 'active' : ''}`}
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')}
          title="Underline (Ctrl+U)"
          disabled={isSourceMode}
        >
          <Underline size={14} />
        </button>
        <button
          type="button"
          className={`lex-btn ${isStrikethrough ? 'active' : ''}`}
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough')}
          title="Strikethrough"
          disabled={isSourceMode}
        >
          <Strikethrough size={14} />
        </button>
        <button
          type="button"
          className={`lex-btn ${isCode ? 'active' : ''}`}
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code')}
          title="Inline Code"
          disabled={isSourceMode}
        >
          <Code size={14} />
        </button>

        <div className="lex-divider" />

        {/* Lists */}
        <button
          type="button"
          className={`lex-btn ${blockType === 'ul' ? 'active' : ''}`}
          onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)}
          title="Bulleted List"
          disabled={isSourceMode}
        >
          <List size={15} />
        </button>
        <button
          type="button"
          className={`lex-btn ${blockType === 'ol' ? 'active' : ''}`}
          onClick={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)}
          title="Numbered List"
          disabled={isSourceMode}
        >
          <ListOrdered size={15} />
        </button>

        <div className="lex-divider" />

        {/* Alignment */}
        <button
          type="button"
          className="lex-btn"
          onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'left')}
          title="Align Left"
          disabled={isSourceMode}
        >
          <AlignLeft size={14} />
        </button>
        <button
          type="button"
          className="lex-btn"
          onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'center')}
          title="Align Center"
          disabled={isSourceMode}
        >
          <AlignCenter size={14} />
        </button>
        <button
          type="button"
          className="lex-btn"
          onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'right')}
          title="Align Right"
          disabled={isSourceMode}
        >
          <AlignRight size={14} />
        </button>

        <div className="lex-divider" />

        {/* Inserts: Link, CTA Button, Divider */}
        <button
          type="button"
          className="lex-btn"
          onClick={insertLink}
          title="Insert Link"
          disabled={isSourceMode}
        >
          <Link2 size={14} />
        </button>
        <button
          type="button"
          className="lex-pill-btn"
          onClick={insertCtaButton}
          title="Insert Call-to-Action Button"
          disabled={isSourceMode}
        >
          <MousePointerClick size={13} />
          <span>Button</span>
        </button>
        <button
          type="button"
          className="lex-pill-btn"
          onClick={insertDivider}
          title="Insert Divider Line"
          disabled={isSourceMode}
        >
          <Minus size={13} />
          <span>Divider</span>
        </button>
      </div>

      {/* Right Tool Group: Templates & Mode Toggle */}
      <div className="lex-toolbar-right">
        <div className="lex-select-wrapper">
          <LayoutTemplate size={12} className="lex-select-icon" />
          <select
            className="lex-select"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) {
                onInsertTemplate(e.target.value);
                e.target.value = '';
              }
            }}
            disabled={isSourceMode}
          >
            <option value="" disabled>Templates</option>
            <option value="corporate">Corporate Announcement</option>
            <option value="welcome">Welcome Onboarding</option>
            <option value="action">Action Required</option>
            <option value="meeting">Meeting Summary</option>
          </select>
        </div>

        <button
          type="button"
          className={`lex-mode-toggle ${isSourceMode ? 'active' : ''}`}
          onClick={onToggleSourceMode}
          title={isSourceMode ? 'Switch to Visual Editor' : 'Edit Raw HTML Code'}
        >
          {isSourceMode ? <Eye size={13} /> : <Code2 size={13} />}
          <span>{isSourceMode ? 'Visual' : 'HTML'}</span>
        </button>
      </div>
    </div>
  );
};

// Initial HTML Hydration Plugin
const InitialHtmlPlugin: React.FC<{ initialHtml: string }> = ({ initialHtml }) => {
  const [editor] = useLexicalComposerContext();
  const lastHtmlRef = useRef<string>('');

  useEffect(() => {
    if (initialHtml && initialHtml !== lastHtmlRef.current) {
      lastHtmlRef.current = initialHtml;
      editor.update(() => {
        try {
          const parser = new DOMParser();
          const dom = parser.parseFromString(initialHtml, 'text/html');
          const sourceNode = dom.body || dom;
          const nodes = $generateNodesFromDOM(editor, sourceNode);
          const root = $getRoot();
          root.clear();

          let currentP: ParagraphNode | null = null;
          for (const node of nodes) {
            if ($isElementNode(node) || $isDecoratorNode(node)) {
              if (currentP) {
                root.append(currentP);
                currentP = null;
              }
              root.append(node);
            } else {
              // Wrap inline/text node in a ParagraphNode to respect Lexical Root invariant
              if (!currentP) {
                currentP = $createParagraphNode();
              }
              currentP.append(node);
            }
          }
          if (currentP) {
            root.append(currentP);
          }

          if (root.getChildrenSize() === 0) {
            root.append($createParagraphNode());
          }
        } catch (err) {
          console.warn('InitialHtmlPlugin safe fallback:', err);
          const root = $getRoot();
          if (root.getChildrenSize() === 0) {
            root.append($createParagraphNode());
          }
        }
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

  useEffect(() => {
    setRawHtml(value || '');
  }, [value]);

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
        <h2 style="color: #111827; font-size: 18px; margin: 0 0 10px 0; font-weight: 700;">Important Corporate Update</h2>
        <p style="color: #374151; line-height: 1.6; margin: 0 0 12px 0;">Dear Colleagues,</p>
        <p style="color: #374151; line-height: 1.6; margin: 0 0 12px 0;">We are pleased to share our operational milestones and strategic roadmap for the upcoming quarter. Please review the key briefing items outlined below:</p>
        <ul style="color: #374151; line-height: 1.6; padding-left: 24px; margin: 12px 0;">
          <li>Infrastructure resilience & mail security upgrades completed</li>
          <li>Updated SLA commitments for enterprise partners</li>
          <li>Scheduled maintenance window this Saturday 02:00 UTC</li>
        </ul>
        <p style="color: #374151; line-height: 1.6; margin: 12px 0;">If you have any questions or feedback, please reach out directly to the operations desk.</p>
        <p style="color: #111827; font-weight: 600; margin: 16px 0 0 0;">Best regards,<br/><span style="color: #4B5563; font-weight: 400;">Corporate Operations Team</span></p>
      `;
    } else if (type === 'welcome') {
      tplHtml = `
        <h2 style="color: #111827; font-size: 18px; margin: 0 0 10px 0; font-weight: 700;">Welcome to the Platform!</h2>
        <p style="color: #374151; line-height: 1.6; margin: 0 0 12px 0;">Hello and welcome aboard! Your enterprise mailbox has been provisioned with end-to-end TLS encryption and priority delivery.</p>
        <p style="color: #374151; line-height: 1.6; margin: 0 0 14px 0;">To get started with your inbox configuration and set up your multi-device credentials, click the button below:</p>
        <div style="margin: 20px 0;">
          <a href="https://yourdomain.com" target="_blank" style="background-color: #111827; color: #FFFFFF; padding: 10px 22px; border-radius: 6px; font-weight: 600; font-size: 13px; text-decoration: none; display: inline-block;">Access Workspace</a>
        </div>
        <p style="color: #6B7280; font-size: 12px; margin: 16px 0 0 0;">Need assistance? Our support team is available 24/7.</p>
      `;
    } else if (type === 'action') {
      tplHtml = `
        <h2 style="color: #961C1C; font-size: 18px; margin: 0 0 10px 0; font-weight: 700;">Action Required: Security Verification</h2>
        <p style="color: #374151; line-height: 1.6; margin: 0 0 12px 0;">A critical authorization request requires your immediate attention and verification within 24 hours.</p>
        <blockquote style="border-left: 3px solid #C92A2A; padding: 10px 14px; margin: 14px 0; color: #374151; font-style: normal; background-color: #FFF5F5; border-radius: 0 6px 6px 0;">
          <strong>Ticket ID:</strong> #SEC-9842<br/>
          <strong>Action:</strong> Domain Certificate Renewal Approval<br/>
          <strong>Initiator:</strong> Security Operations Center
        </blockquote>
        <div style="margin: 20px 0;">
          <a href="https://yourdomain.com" target="_blank" style="background-color: #111827; color: #FFFFFF; padding: 10px 22px; border-radius: 6px; font-weight: 600; font-size: 13px; text-decoration: none; display: inline-block;">Review & Confirm</a>
        </div>
      `;
    } else if (type === 'meeting') {
      tplHtml = `
        <h2 style="color: #111827; font-size: 18px; margin: 0 0 10px 0; font-weight: 700;">Meeting Summary & Action Items</h2>
        <p style="color: #374151; line-height: 1.6; margin: 0 0 12px 0;">Here is a recap of today's synchronization meeting and agreed next steps.</p>
        <h3 style="color: #111827; font-size: 15px; font-weight: 600; margin: 14px 0 6px 0;">Key Decisions:</h3>
        <ul style="color: #374151; line-height: 1.6; padding-left: 24px; margin: 8px 0 12px 0;">
          <li>Approved the new mail routing policies.</li>
          <li>Target production update scheduled for this week.</li>
        </ul>
        <h3 style="color: #111827; font-size: 15px; font-weight: 600; margin: 14px 0 6px 0;">Next Actions:</h3>
        <ul style="color: #374151; line-height: 1.6; padding-left: 24px; margin: 8px 0 12px 0;">
          <li><strong>Dev Team:</strong> Complete automated verification tests.</li>
          <li><strong>Ops Team:</strong> Monitor mail queue throughput.</li>
        </ul>
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
    <div className="lexical-editor-root">
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
                padding: '16px 20px',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize: '12.5px',
                lineHeight: 1.6,
                border: 'none',
                outline: 'none',
                resize: 'vertical',
                backgroundColor: '#18181B',
                color: '#E4E4E7',
                boxSizing: 'border-box',
              }}
              placeholder="<!-- Write or paste raw HTML code here -->"
            />
          ) : (
            <>
              <RichTextPlugin
                contentEditable={
                  <ContentEditable
                    className="lexical-content-editable"
                    style={{
                      flex: 1,
                      minHeight,
                      padding: '16px 20px',
                      boxSizing: 'border-box',
                    }}
                  />
                }
                placeholder={
                  <div
                    style={{
                      position: 'absolute',
                      top: '16px',
                      left: '20px',
                      color: '#9CA3AF',
                      pointerEvents: 'none',
                      fontSize: '14px',
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

      {/* Editor CSS styles */}
      <style>{`
        .lexical-editor-root {
          border: 1px solid #E5E7EB;
          border-radius: 10px;
          overflow: hidden;
          background-color: #FFFFFF;
          display: flex;
          flex-direction: column;
          transition: border-color 150ms ease, box-shadow 150ms ease;
        }
        .lexical-editor-root:focus-within {
          border-color: #111827;
          box-shadow: 0 0 0 1px #111827;
        }

        /* Toolbar Layout */
        .lex-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 6px;
          padding: 6px 10px;
          background-color: #FAFAFA;
          border-bottom: 1px solid #E5E7EB;
          user-select: none;
        }

        .lex-toolbar-group {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 2px;
        }

        .lex-toolbar-right {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-left: auto;
        }

        /* Borderless Ghost Action Buttons */
        .lex-btn {
          width: 28px;
          height: 28px;
          padding: 0;
          border: none;
          background: transparent;
          border-radius: 6px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #4B5563;
          cursor: pointer;
          transition: all 120ms ease;
          box-sizing: border-box;
        }

        .lex-btn:hover:not(:disabled) {
          background-color: #E9ECEF;
          color: #111827;
        }

        .lex-btn.active {
          background-color: #111827;
          color: #FFFFFF;
        }

        .lex-btn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        /* Borderless Pill Action Buttons */
        .lex-pill-btn {
          height: 28px;
          padding: 0 8px;
          border: none;
          background: transparent;
          border-radius: 6px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11.5px;
          font-weight: 500;
          color: #4B5563;
          cursor: pointer;
          transition: all 120ms ease;
          box-sizing: border-box;
        }

        .lex-pill-btn:hover:not(:disabled) {
          background-color: #E9ECEF;
          color: #111827;
        }

        .lex-pill-btn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        /* Thin Divider */
        .lex-divider {
          width: 1px;
          height: 18px;
          background-color: #E5E7EB;
          margin: 0 4px;
          flex-shrink: 0;
        }

        /* Template Selector */
        .lex-select-wrapper {
          position: relative;
          display: inline-flex;
          align-items: center;
        }

        .lex-select-icon {
          position: absolute;
          left: 8px;
          color: #6B7280;
          pointer-events: none;
        }

        .lex-select {
          height: 28px;
          padding: 0 10px 0 26px;
          font-size: 11.5px;
          font-weight: 500;
          border-radius: 6px;
          border: 1px solid #E5E7EB;
          background-color: #FFFFFF;
          color: #374151;
          outline: none;
          cursor: pointer;
          transition: all 120ms ease;
        }

        .lex-select:hover:not(:disabled) {
          border-color: #CBD5E1;
          background-color: #F8F9FA;
        }

        .lex-select:focus {
          border-color: #111827;
        }

        /* Mode Toggle */
        .lex-mode-toggle {
          height: 28px;
          padding: 0 8px;
          border-radius: 6px;
          border: 1px solid #E5E7EB;
          background-color: #FFFFFF;
          color: #4B5563;
          font-size: 11.5px;
          font-weight: 500;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          cursor: pointer;
          transition: all 120ms ease;
        }

        .lex-mode-toggle:hover {
          background-color: #F8F9FA;
          color: #111827;
          border-color: #CBD5E1;
        }

        .lex-mode-toggle.active {
          background-color: #111827;
          color: #FFFFFF;
          border-color: #111827;
        }

        /* Content Editable Area */
        .lexical-content-editable {
          outline: none;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          color: #111827;
          font-size: 14px;
          line-height: 1.65;
        }

        .lexical-paragraph { margin: 0 0 12px 0; }
        .lexical-h1 { font-size: 20px; font-weight: 700; margin: 16px 0 8px 0; color: #111827; letter-spacing: -0.01em; }
        .lexical-h2 { font-size: 17px; font-weight: 600; margin: 14px 0 6px 0; color: #111827; letter-spacing: -0.01em; }
        .lexical-h3 { font-size: 15px; font-weight: 600; margin: 12px 0 4px 0; color: #111827; }
        .lexical-quote { border-left: 3px solid #111827; padding-left: 14px; margin: 14px 0; color: #4B5563; font-style: italic; }
        .lexical-ul { padding-left: 24px; margin: 10px 0; list-style-type: disc; }
        .lexical-ol { padding-left: 24px; margin: 10px 0; list-style-type: decimal; }
        .lexical-li { margin: 4px 0; }
        .lexical-bold { font-weight: 700; }
        .lexical-italic { font-style: italic; }
        .lexical-underline { text-decoration: underline; }
        .lexical-strikethrough { text-decoration: line-through; }
        .lexical-code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; background-color: #F1F3F5; padding: 2px 5px; border-radius: 4px; font-size: 12.5px; color: #111827; }
        .lexical-link { color: #1971C2; text-decoration: underline; cursor: pointer; }
      `}</style>
    </div>
  );
};
export default LexicalMailEditor;
