'use client';

import { useEffect, useRef, useState } from 'react';
import { Extension } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import FontFamily from '@tiptap/extension-font-family';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import { normalizeRichTextUrl, validateInlineImage } from '@/lib/rich-text-content';
import {
  AlignLeft,
  AlignCenter,
  AlignJustify,
  AlignRight,
  Bold,
  CheckSquare,
  ChevronDown,
  Eraser,
  Highlighter,
  ImagePlus,
  Indent,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  MessageSquarePlus,
  Minus,
  Outdent,
  Plus,
  Redo2,
  Search,
  Type,
  Underline as UnderlineIcon,
  Undo2,
  Upload,
  X,
} from 'lucide-react';

function safeFontSize(value: string | null | undefined) {
  if (!value || !/^\d{1,3}(?:\.\d{1,2})?(?:pt|px|rem|em|%)$/i.test(value.trim())) return null;
  const amount = Number.parseFloat(value);
  return amount >= 1 && amount <= 128 ? value.trim() : null;
}

function safeLineHeight(value: string | null | undefined) {
  if (!value || !/^\d(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const amount = Number(value);
  return amount >= 1 && amount <= 3 ? String(amount) : null;
}

const TextFormatting = Extension.create({
  name: 'textFormatting',
  addGlobalAttributes() {
    return [{
      types: ['textStyle'],
      attributes: {
        fontSize: {
          default: null,
          parseHTML: (element: HTMLElement) => safeFontSize(element.style.fontSize),
          renderHTML: (attributes: { fontSize?: string | null }) => {
            const size = safeFontSize(attributes.fontSize);
            return size ? { style: `font-size: ${size}` } : {};
          },
        },
      },
    }, {
      types: ['paragraph', 'heading'],
      attributes: {
        lineHeight: {
          default: null,
          parseHTML: (element: HTMLElement) => safeLineHeight(element.style.lineHeight),
          renderHTML: (attributes: { lineHeight?: string | null }) => {
            const lineHeight = safeLineHeight(attributes.lineHeight);
            return lineHeight ? { style: `line-height: ${lineHeight}` } : {};
          },
        },
        indent: {
          default: 0,
          parseHTML: (element: HTMLElement) => Math.max(0, Math.min(8, Number.parseInt(element.dataset.indent || '0', 10) || 0)),
          renderHTML: (attributes: { indent?: number }) => {
            const indent = Math.max(0, Math.min(8, Number.isInteger(attributes.indent) ? attributes.indent as number : 0));
            return indent ? { style: `margin-left: ${indent * 2}rem`, 'data-indent': String(indent) } : {};
          },
        },
      },
    }, {
      types: ['image'],
      attributes: {
        width: {
          default: 100,
          parseHTML: (element: HTMLElement) => {
            const parsed = Number.parseFloat(element.style.width || element.getAttribute('width') || '100');
            return Number.isFinite(parsed) ? Math.max(25, Math.min(100, parsed)) : 100;
          },
          renderHTML: (attributes: { width?: number }) => {
            const width = Math.max(25, Math.min(100, Number.isFinite(attributes.width) ? Number(attributes.width) : 100));
            return { width: `${width}%`, style: `width: ${width}%; height: auto` };
          },
        },
        alignment: {
          default: 'center',
          parseHTML: (element: HTMLElement) => ['left', 'center', 'right'].includes(element.dataset.alignment || '') ? element.dataset.alignment : 'center',
          renderHTML: (attributes: { alignment?: string }) => {
            const alignment = ['left', 'center', 'right'].includes(attributes.alignment || '') ? attributes.alignment : 'center';
            const margin = alignment === 'left' ? '0 auto 0 0' : alignment === 'right' ? '0 0 0 auto' : '0 auto';
            return { 'data-alignment': alignment, style: `display: block; margin: ${margin}` };
          },
        },
      },
    }, {
      types: ['bulletList'],
      attributes: {
        bulletStyle: {
          default: 'disc',
          parseHTML: (element: HTMLElement) => element.dataset.bulletStyle || 'disc',
          renderHTML: (attributes: { bulletStyle?: string }) => ({ 'data-bullet-style': attributes.bulletStyle || 'disc' }),
        },
      },
    }, {
      types: ['orderedList'],
      attributes: {
        numberStyle: {
          default: 'decimal',
          parseHTML: (element: HTMLElement) => element.dataset.numberStyle || 'decimal',
          renderHTML: (attributes: { numberStyle?: string }) => ({ 'data-number-style': attributes.numberStyle || 'decimal' }),
        },
      },
    }];
  },
});

const iconButton = 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-orange-300';
const activeButton = 'bg-orange-100 text-orange-700 hover:bg-orange-100 hover:text-orange-700';
const selectClass = 'h-8 rounded-md border border-transparent bg-transparent px-2 text-xs font-medium text-slate-700 hover:border-slate-200 focus:border-orange-300 focus:outline-none';
const colorSwatches = ['#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff', '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff', '#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc', '#cc4125', '#e06666', '#f6b26b', '#ffd966', '#93c47d', '#76a5af', '#6d9eeb', '#6fa8dc', '#8e7cc3', '#c27ba0', '#a61c00', '#cc0000', '#e69138', '#f1c232', '#6aa84f', '#45818e', '#3c78d8', '#3d85c6', '#674ea7', '#a64d79', '#85200c', '#990000', '#b45f06', '#bf9000', '#38761d', '#134f5c', '#1155cc', '#0b5394', '#351c75', '#741b47', '#5b0f00', '#660000', '#783f04', '#7f6000', '#274e13', '#0c343d', '#1c4587', '#073763', '#20124d', '#4c1130'];

type IconButtonProps = {
  label: string;
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
};

function IconButton({ label, title, active, disabled = false, onClick, children }: IconButtonProps) {
  return <button type="button" aria-label={label} title={title} aria-pressed={active} disabled={disabled} className={`${iconButton} ${active ? activeButton : ''} disabled:cursor-not-allowed disabled:opacity-35`} onMouseDown={(event) => event.preventDefault()} onClick={onClick}>{children}</button>;
}

function Divider() {
  return <span className="mx-1 h-5 w-px shrink-0 bg-slate-200" aria-hidden="true" />;
}

function LineSpacingIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true" className="h-[17px] w-[17px] fill-none stroke-current" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 4.5h8M2.5 9.5h8M2.5 14.5h8M15 3v13M12.5 5.5 15 3l2.5 2.5M12.5 13.5 15 16l2.5-2.5" /></svg>;
}

function BulletPreview({ style }: { style: string }) {
  const marker = style === 'circle' ? '○' : style === 'square' ? '▪' : style === 'diamond' ? '◆' : style === 'arrow' ? '➢' : style === 'star' ? '★' : '●';
  return <span className="grid gap-1.5">{[0, 1, 2].map((item) => <span key={item} className="flex items-center gap-2"><span className="w-3 text-center text-[10px] text-slate-800">{marker}</span><span className="h-1.5 flex-1 rounded-sm bg-slate-300" /></span>)}</span>;
}

function NumberPreview({ style }: { style: string }) {
  const values: Record<string, string[]> = { decimal: ['1.', '2.', '3.'], 'decimal-leading-zero': ['01.', '02.', '03.'], 'lower-alpha': ['a.', 'b.', 'c.'], 'upper-alpha': ['A.', 'B.', 'C.'], 'lower-roman': ['i.', 'ii.', 'iii.'], 'upper-roman': ['I.', 'II.', 'III.'] };
  return <span className="grid gap-1.5">{(values[style] ?? values.decimal).map((marker) => <span key={marker} className="flex items-center gap-2"><span className="w-6 text-right text-[10px] text-slate-800">{marker}</span><span className="h-1.5 flex-1 rounded-sm bg-slate-300" /></span>)}</span>;
}

function ColorPalette({ label, value, onSelect, onClear, clearLabel }: { label: string; value?: string; onSelect: (color: string) => void; onClear?: () => void; clearLabel?: string }) {
  return <div className="w-48 rounded-md border border-slate-200 bg-white p-2 shadow-xl"><p className="px-1 pb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>{onClear && <button type="button" onClick={onClear} className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-xs text-slate-600 hover:bg-slate-100"><span className="grid h-4 w-4 place-items-center rounded border border-slate-300 text-[10px] leading-none">/</span>{clearLabel ?? 'None'}</button>}<div className="mt-1 grid grid-cols-10 gap-0.5">{colorSwatches.map((color) => <button type="button" key={color} aria-label={`Use ${color}`} title={color} onClick={() => onSelect(color)} className={`h-4 w-4 rounded-full border ${value?.toLowerCase() === color.toLowerCase() ? 'ring-2 ring-orange-400 ring-offset-1' : 'border-slate-200 hover:scale-110'}`} style={{ backgroundColor: color }} />)}</div><div className="mt-2 border-t border-slate-100 pt-2"><label className="flex items-center gap-2 px-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Custom<input aria-label={`Custom ${label}`} type="color" value={value || '#071b41'} onChange={(event) => onSelect(event.target.value)} className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0" /></label></div></div>;
}

export function ContentEditor({
  value,
  onChange,
  placeholder = 'Start writing event content...',
  editorLabel = 'Event content editor',
  onComment,
  onImageUpload,
  editable = true,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  editorLabel?: string;
  onComment?: (note: string) => void;
  onImageUpload?: (file: File) => Promise<string>;
  editable?: boolean;
}) {
  const lastValue = useRef(value);
  const imageInput = useRef<HTMLInputElement>(null);
  // Native toolbar controls (selects, color inputs, popovers) take focus away
  // from ProseMirror. Keep the editor selection so commands still target the
  // user's selection instead of falling back to a broader document selection.
  const savedSelection = useRef({ from: 1, to: 1 });
  const [, refresh] = useState(0);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [imageOpen, setImageOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [imageSearch, setImageSearch] = useState('');
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState('');
  const [linkError, setLinkError] = useState('');
  const [fontSizeDraft, setFontSizeDraft] = useState<string | null>(null);
  const [textColorOpen, setTextColorOpen] = useState(false);
  const [highlightColorOpen, setHighlightColorOpen] = useState(false);
  const [bulletOpen, setBulletOpen] = useState(false);
  const [numberedOpen, setNumberedOpen] = useState(false);
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      FontFamily,
      TextFormatting,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({
        openOnClick: !editable,
        autolink: true,
        defaultProtocol: 'https',
        isAllowedUri: (url) => normalizeRichTextUrl(url) !== null,
      }),
      Image.configure({ inline: false, allowBase64: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: value || '<p></p>',
    editable,
    immediatelyRender: false,
    editorProps: { attributes: { 'data-placeholder': placeholder, 'aria-label': editorLabel } },
    onUpdate: ({ editor: current }) => {
      lastValue.current = current.getHTML();
      onChange(lastValue.current);
      refresh((count) => count + 1);
    },
    onSelectionUpdate: ({ editor: current }) => {
      savedSelection.current = {
        from: current.state.selection.from,
        to: current.state.selection.to,
      };
      refresh((count) => count + 1);
    },
  });

  useEffect(() => {
    if (editor && value !== lastValue.current && value !== editor.getHTML()) {
      editor.commands.setContent(value || '<p></p>');
      lastValue.current = value;
    }
  }, [editor, value]);

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  if (!editor) return editable ? <div className="min-h-[120px] rounded-b-lg border border-slate-200 p-4 text-sm text-slate-400">Loading editor...</div> : null;

  const textStyle = editor.getAttributes('textStyle') as { fontSize?: string; fontFamily?: string; color?: string };
  const selectedSize = Number.parseInt(textStyle.fontSize || '12', 10) || 12;
  const selectedFamily = textStyle.fontFamily || 'Arial';
  const highlightStyle = editor.getAttributes('highlight') as { color?: string };
  const rememberSelection = () => {
    savedSelection.current = {
      from: editor.state.selection.from,
      to: editor.state.selection.to,
    };
  };
  const restoreSelection = () => {
    const maxPosition = editor.state.doc.content.size;
    const from = Math.max(1, Math.min(savedSelection.current.from, maxPosition));
    const to = Math.max(from, Math.min(savedSelection.current.to, maxPosition));
    editor.commands.setTextSelection({ from, to });
  };
  const runAtSelection = (command: () => void) => {
    restoreSelection();
    command();
  };
  const currentNode = editor.isActive('heading', { level: 1 }) ? 'heading-1'
    : editor.isActive('heading', { level: 2 }) ? 'heading-2'
      : editor.isActive('heading', { level: 3 }) ? 'heading-3'
        : editor.isActive('heading', { level: 4 }) ? 'heading-4'
          : textStyle.fontSize === '26pt' ? 'title'
            : textStyle.fontSize === '16pt' ? 'subtitle' : 'paragraph';
  const activeBlock = editor.isActive('heading') ? 'heading' : 'paragraph';
  const currentLineHeight = String(editor.getAttributes(activeBlock).lineHeight || '1.5');
  const currentAlignment = editor.getAttributes(activeBlock).textAlign || 'left';
  const imageActive = editor.isActive('image');
  const imageAttributes = editor.getAttributes('image') as { width?: number; alignment?: string };

  const setFontSize = (size: number) => {
    setFontSizeDraft(null);
    runAtSelection(() => editor.chain().focus().setMark('textStyle', { fontSize: `${Math.min(96, Math.max(6, size))}pt` }).run());
  };
  const setLineHeight = (lineHeight: string) => {
    runAtSelection(() => editor.chain().focus().updateAttributes(activeBlock, { lineHeight }).run());
  };
  const changeIndent = (delta: number) => {
    restoreSelection();
    if (editor.isActive('listItem') || editor.isActive('taskItem')) {
      const listItem = editor.isActive('taskItem') ? 'taskItem' : 'listItem';
      if (delta > 0) editor.chain().focus().sinkListItem(listItem).run();
      else editor.chain().focus().liftListItem(listItem).run();
      return;
    }
    const node = activeBlock;
    const current = Number(editor.getAttributes(node).indent || 0);
    editor.chain().focus().updateAttributes(node, { indent: Math.max(0, Math.min(8, current + delta)) }).run();
  };
  const setBulletStyle = (style: string) => {
    runAtSelection(() => {
      if (editor.isActive('bulletList')) editor.chain().focus().updateAttributes('bulletList', { bulletStyle: style }).run();
      else editor.chain().focus().toggleBulletList().updateAttributes('bulletList', { bulletStyle: style }).run();
    });
    setBulletOpen(false);
  };
  const setNumberStyle = (style: string) => {
    runAtSelection(() => {
      if (editor.isActive('orderedList')) editor.chain().focus().updateAttributes('orderedList', { numberStyle: style }).run();
      else editor.chain().focus().toggleOrderedList().updateAttributes('orderedList', { numberStyle: style }).run();
    });
    setNumberedOpen(false);
  };
  const addComment = () => {
    const note = window.prompt('Add a note');
    if (note?.trim()) {
      onComment?.(note.trim());
      runAtSelection(() => editor.chain().focus().toggleBlockquote().insertContent(note.trim()).toggleBlockquote().run());
    }
  };
  const addImageFile = async (file: File) => {
    const validationError = validateInlineImage(file);
    if (validationError) {
      setImageError(validationError);
      return;
    }
    setImageError('');
    setImageBusy(true);
    try {
      const src = onImageUpload
        ? await onImageUpload(file)
        : await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Image could not be read.'));
          reader.onerror = () => reject(new Error('Image could not be read. Try another file.'));
          reader.onabort = () => reject(new Error('Image reading was cancelled.'));
          reader.readAsDataURL(file);
        });
      if (!src) throw new Error('Image upload did not return an image URL.');
      runAtSelection(() => editor.chain().focus().setImage({ src, alt: file.name }).run());
      setImageOpen(false);
    } catch (error) {
      setImageError(error instanceof Error ? error.message : 'Image upload failed. Try again.');
    } finally {
      setImageBusy(false);
      if (imageInput.current) imageInput.current.value = '';
    }
  };
  const submitLink = () => {
    const href = normalizeRichTextUrl(linkUrl);
    if (linkUrl.trim() && !href) {
      setLinkError('Enter an HTTP, HTTPS, email, phone, or relative link.');
      return;
    }
    setLinkError('');
    if (linkUrl.trim() && !href) return;
    runAtSelection(() => {
      if (href) editor.chain().focus().setLink({ href }).run();
      else editor.chain().focus().unsetLink().run();
    });
    setLinkOpen(false);
  };
  const submitImageUrl = () => {
    const src = normalizeRichTextUrl(imageUrl, 'image');
    if (!src) {
      setImageError('Enter a valid HTTP or HTTPS image URL.');
      return;
    }
    setImageError('');
    runAtSelection(() => editor.chain().focus().setImage({ src, alt: 'Event content image' }).run());
    setImageUrl('');
    setImageOpen(false);
  };
  const tableActive = editor.isActive('table');

  return (
    <div className={`relative min-w-0 w-full overflow-visible ${editable ? 'rounded-lg border border-slate-200 bg-white' : 'content-editor--readonly'}`}>
      {editable && (
      <div onMouseDownCapture={rememberSelection} onFocusCapture={rememberSelection} className="flex flex-wrap items-center gap-0.5 rounded-t-lg border-b border-slate-200 bg-slate-50 p-1.5">
        <IconButton label="Undo" title="Undo" disabled={!editor.can().undo()} onClick={() => runAtSelection(() => editor.chain().focus().undo().run())}><Undo2 size={16} /></IconButton>
        <IconButton label="Redo" title="Redo" disabled={!editor.can().redo()} onClick={() => runAtSelection(() => editor.chain().focus().redo().run())}><Redo2 size={16} /></IconButton>
        <Divider />
        <div className="relative"><select aria-label="Paragraph style" className={`${selectClass} min-w-28 appearance-none pr-7`} value={currentNode} onChange={(event) => runAtSelection(() => {
          const style = event.target.value;
          if (style === 'paragraph') editor.chain().focus().setParagraph().setMark('textStyle', { fontSize: null }).unsetMark('bold').run();
          else if (style === 'title') editor.chain().focus().setParagraph().setMark('textStyle', { fontSize: '26pt' }).setMark('bold').run();
          else if (style === 'subtitle') editor.chain().focus().setParagraph().setMark('textStyle', { fontSize: '16pt' }).run();
          else editor.chain().focus().toggleHeading({ level: Number(style.replace('heading-', '')) as 1 | 2 | 3 | 4 }).run();
        })}><option value="paragraph">Normal text</option><option value="title">Title</option><option value="subtitle">Subtitle</option><option value="heading-1">Heading 1</option><option value="heading-2">Heading 2</option><option value="heading-3">Heading 3</option><option value="heading-4">Heading 4</option></select><ChevronDown className="pointer-events-none absolute right-1 top-2 text-slate-500" size={14} /></div>
        <div className="relative"><select aria-label="Font family" className={`${selectClass} min-w-28 appearance-none pr-7`} value={selectedFamily} onChange={(event) => runAtSelection(() => editor.chain().focus().setFontFamily(event.target.value).run())}><option value="Arial">Arial</option><option value="Times New Roman">Times New Roman</option><option value="Georgia">Georgia</option><option value="Courier New">Courier New</option><option value="Roboto">Roboto</option><option value="Montserrat">Montserrat</option></select><ChevronDown className="pointer-events-none absolute right-1 top-2 text-slate-500" size={14} /></div>
        <div className="flex h-8 items-center overflow-hidden rounded-md border border-slate-300 bg-white shadow-sm"><button type="button" aria-label="Decrease font size" title="Decrease font size" onMouseDown={(event) => event.preventDefault()} onClick={() => setFontSize(selectedSize - 1)} className="grid h-full w-8 place-items-center text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"><Minus size={15} /></button><input aria-label="Font size" type="number" min="6" max="96" value={fontSizeDraft ?? String(selectedSize)} onFocus={rememberSelection} onChange={(event) => setFontSizeDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); setFontSize(Number(fontSizeDraft) || selectedSize); } }} onBlur={() => { if (fontSizeDraft !== null) setFontSize(Number(fontSizeDraft) || selectedSize); }} className="h-full w-9 border-x border-slate-200 text-center text-xs font-semibold text-[#071b41] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" /><button type="button" aria-label="Increase font size" title="Increase font size" onMouseDown={(event) => event.preventDefault()} onClick={() => setFontSize(selectedSize + 1)} className="grid h-full w-8 place-items-center text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"><Plus size={15} /></button></div>
        <Divider />
        <IconButton label="Bold" title="Bold" active={editor.isActive('bold')} onClick={() => runAtSelection(() => editor.chain().focus().toggleBold().run())}><Bold size={16} /></IconButton>
        <IconButton label="Italic" title="Italic" active={editor.isActive('italic')} onClick={() => runAtSelection(() => editor.chain().focus().toggleItalic().run())}><Italic size={16} /></IconButton>
        <IconButton label="Underline" title="Underline" active={editor.isActive('underline')} onClick={() => runAtSelection(() => editor.chain().focus().toggleUnderline().run())}><UnderlineIcon size={16} /></IconButton>
        <div className="relative"><IconButton label="Text color" title="Text color" active={Boolean(textStyle.color)} onClick={() => { rememberSelection(); setTextColorOpen((open) => !open); setHighlightColorOpen(false); }}><span className="relative"><Type size={16} /><span className="absolute -bottom-1 left-0 h-0.5 w-4" style={{ backgroundColor: textStyle.color || '#071b41' }} /></span></IconButton>{textColorOpen && <div className="absolute left-0 top-10 z-30"><ColorPalette label="Text color" value={textStyle.color} onSelect={(color) => { runAtSelection(() => editor.chain().focus().setColor(color).run()); setTextColorOpen(false); }} onClear={() => { runAtSelection(() => editor.chain().focus().unsetColor().run()); setTextColorOpen(false); }} /></div>}</div>
        <div className="relative"><IconButton label="Highlight color" title="Highlight color" active={editor.isActive('highlight')} onClick={() => { rememberSelection(); setHighlightColorOpen((open) => !open); setTextColorOpen(false); }}><span className="relative"><Highlighter size={16} /><span className="absolute -bottom-1 left-0 h-0.5 w-4" style={{ backgroundColor: highlightStyle.color || '#facc15' }} /></span></IconButton>{highlightColorOpen && <div className="absolute left-0 top-10 z-30"><ColorPalette label="Highlight color" value={highlightStyle.color} onSelect={(color) => { runAtSelection(() => editor.chain().focus().setHighlight({ color }).run()); setHighlightColorOpen(false); }} onClear={() => { runAtSelection(() => editor.chain().focus().unsetHighlight().run()); setHighlightColorOpen(false); }} /></div>}</div>
        <Divider />
        <div className="relative"><IconButton label="Insert or edit link" title="Insert or edit link" active={editor.isActive('link')} onClick={() => { setLinkUrl(editor.getAttributes('link').href || ''); setLinkError(''); setLinkOpen((open) => !open); }}><Link2 size={16} /></IconButton>{linkOpen && <div className="absolute left-0 top-10 z-20 w-72 rounded-lg border border-slate-200 bg-white p-2 shadow-lg"><div className="flex gap-2"><input autoFocus aria-label="Link URL" aria-invalid={Boolean(linkError)} value={linkUrl} onChange={(event) => { setLinkUrl(event.target.value); setLinkError(''); }} onKeyDown={(event) => { if (event.key === 'Enter') submitLink(); if (event.key === 'Escape') setLinkOpen(false); }} placeholder="https://example.com" className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:border-orange-400" /><button type="button" onClick={submitLink} className="rounded bg-orange-600 px-2 text-xs font-bold text-white">Apply</button></div>{editor.isActive('link') && <button type="button" onClick={() => { runAtSelection(() => editor.chain().focus().unsetLink().run()); setLinkOpen(false); }} className="mt-2 px-1 text-xs font-semibold text-slate-600 underline">Remove link</button>}{linkError && <p role="alert" className="mt-2 text-xs text-red-700">{linkError}</p>}</div>}</div>
        <IconButton label="Add note" title="Add note" onClick={addComment}><MessageSquarePlus size={16} /></IconButton>
        <div className="relative"><IconButton label="Insert image" title="Insert image" onClick={() => { setImageError(''); setImageOpen((open) => !open); }}><ImagePlus size={16} /></IconButton>{imageOpen && <div className="absolute right-0 top-10 z-20 w-[min(18rem,calc(100vw-2rem))] space-y-3 rounded-lg border border-slate-200 bg-white p-3 shadow-lg"><button type="button" disabled={imageBusy} onClick={() => imageInput.current?.click()} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-slate-50 disabled:opacity-50"><Upload size={15} />{imageBusy ? 'Uploading image…' : 'Upload from computer'}</button><div className="flex gap-2"><input aria-label="Image URL" value={imageUrl} onChange={(event) => { setImageUrl(event.target.value); setImageError(''); }} onKeyDown={(event) => { if (event.key === 'Enter') submitImageUrl(); }} placeholder="Paste image URL" className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:border-orange-400" /><button type="button" onClick={submitImageUrl} className="rounded bg-orange-600 px-2 text-xs font-bold text-white">Insert</button></div><div className="flex gap-2"><input aria-label="Search web images" value={imageSearch} onChange={(event) => setImageSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && imageSearch.trim()) window.open(`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(imageSearch.trim())}`, '_blank', 'noopener,noreferrer'); }} placeholder="Search web images" className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:border-orange-400" /><button type="button" title="Open image search" onClick={() => { if (imageSearch.trim()) window.open(`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(imageSearch.trim())}`, '_blank', 'noopener,noreferrer'); }} className="rounded border border-slate-300 px-2 text-slate-700"><Search size={14} /></button></div>{imageBusy && <p role="status" className="text-xs text-slate-600">Uploading image…</p>}{imageError && <p role="alert" className="text-xs text-red-700">{imageError}</p>}</div>}</div>
        <input ref={imageInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void addImageFile(file); event.currentTarget.value = ''; }} />
        <Divider />
        <div className="relative flex items-center"><IconButton label="Alignment" title="Alignment" active={currentAlignment !== 'left'} onClick={() => runAtSelection(() => editor.chain().focus().setTextAlign('left').run())}>{currentAlignment === 'center' ? <AlignCenter size={16} /> : currentAlignment === 'right' ? <AlignRight size={16} /> : currentAlignment === 'justify' ? <AlignJustify size={16} /> : <AlignLeft size={16} />}</IconButton><ChevronDown className="pointer-events-none -ml-1 text-slate-500" size={12} /><select aria-label="Text alignment" className="absolute inset-0 cursor-pointer opacity-0" value={currentAlignment} onChange={(event) => runAtSelection(() => editor.chain().focus().setTextAlign(event.target.value).run())}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option><option value="justify">Justify</option></select></div>
        <div className="relative flex items-center"><IconButton label="Line and paragraph spacing" title="Line and paragraph spacing" active={currentLineHeight !== '1.5'} onClick={() => setLineHeight('1.5')}><LineSpacingIcon /></IconButton><ChevronDown className="pointer-events-none -ml-1 text-slate-500" size={12} /><select aria-label="Line spacing" className="absolute inset-0 cursor-pointer opacity-0" value={currentLineHeight} onChange={(event) => setLineHeight(event.target.value)}><option value="1">Single</option><option value="1.15">1.15</option><option value="1.5">1.5</option><option value="2">Double</option></select></div>
        <IconButton label="Checklist" title="Checklist" active={editor.isActive('taskList')} onClick={() => runAtSelection(() => editor.chain().focus().toggleTaskList().run())}><ListChecks size={16} /></IconButton>
        <div className="relative flex items-center"><IconButton label="Bulleted list" title="Bulleted list" active={editor.isActive('bulletList')} onClick={() => { runAtSelection(() => editor.chain().focus().toggleBulletList().run()); setBulletOpen(false); }}><List size={16} /></IconButton><button type="button" aria-label="Bulleted list options" title="Bulleted list options" onMouseDown={(event) => event.preventDefault()} onClick={() => { rememberSelection(); setBulletOpen((open) => !open); }} className="inline-flex h-8 w-5 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"><ChevronDown size={12} /></button>{bulletOpen && <div className="absolute left-0 top-10 z-30 grid w-80 grid-cols-3 gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-xl">{['disc', 'circle', 'square', 'diamond', 'arrow', 'star'].map((style) => <button key={style} type="button" title={`Use ${style} bullets`} onMouseDown={(event) => event.preventDefault()} onClick={() => setBulletStyle(style)} className="rounded border border-slate-300 p-2 text-left hover:border-orange-400 hover:bg-orange-50"><BulletPreview style={style} /></button>)}</div>}</div>
        <div className="relative flex items-center"><IconButton label="Numbered list" title="Numbered list" active={editor.isFocused && editor.isActive('orderedList')} onClick={() => { runAtSelection(() => editor.chain().focus().toggleOrderedList().run()); setNumberedOpen(false); }}><ListOrdered size={16} /></IconButton><button type="button" aria-label="Numbered list options" title="Numbered list options" onMouseDown={(event) => event.preventDefault()} onClick={() => { rememberSelection(); setNumberedOpen((open) => !open); }} className="inline-flex h-8 w-5 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"><ChevronDown size={12} /></button>{numberedOpen && <div className="absolute left-0 top-10 z-30 grid w-80 grid-cols-3 gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-xl">{['decimal', 'lower-alpha', 'upper-alpha', 'lower-roman', 'upper-roman', 'decimal-leading-zero'].map((style) => <button key={style} type="button" title={`Use ${style} numbering`} onMouseDown={(event) => event.preventDefault()} onClick={() => setNumberStyle(style)} className="rounded border border-slate-300 p-2 text-left hover:border-orange-400 hover:bg-orange-50"><NumberPreview style={style} /></button>)}</div>}</div>
        <IconButton label="Decrease indent" title="Decrease indent" onClick={() => changeIndent(-1)}><Outdent size={16} /></IconButton>
        <IconButton label="Increase indent" title="Increase indent" onClick={() => changeIndent(1)}><Indent size={16} /></IconButton>
        <IconButton label="Clear formatting" title="Clear formatting" onClick={() => runAtSelection(() => editor.chain().focus().clearNodes().unsetAllMarks().run())}><Eraser size={16} /></IconButton>
        {tableActive && <><Divider /><IconButton label="Add table row" title="Add table row" onClick={() => runAtSelection(() => editor.chain().focus().addRowAfter().run())}><Plus size={15} /></IconButton><IconButton label="Delete table row" title="Delete table row" onClick={() => runAtSelection(() => editor.chain().focus().deleteRow().run())}><Minus size={15} /></IconButton><IconButton label="Add table column" title="Add table column" onClick={() => runAtSelection(() => editor.chain().focus().addColumnAfter().run())}><Plus size={15} /></IconButton><IconButton label="Delete table column" title="Delete table column" onClick={() => runAtSelection(() => editor.chain().focus().deleteColumn().run())}><Minus size={15} /></IconButton></>}
        {imageActive && <><Divider /><label className="flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-600">Image size<select aria-label="Image size" value={imageAttributes.width ?? 100} onChange={(event) => runAtSelection(() => editor.chain().focus().updateAttributes('image', { width: Number(event.target.value) }).run())} className="bg-transparent font-semibold text-slate-800 outline-none"><option value={25}>25%</option><option value={50}>50%</option><option value={75}>75%</option><option value={100}>100%</option></select></label><IconButton label="Align image left" title="Align image left" active={imageAttributes.alignment === 'left'} onClick={() => runAtSelection(() => editor.chain().focus().updateAttributes('image', { alignment: 'left' }).run())}><AlignLeft size={16} /></IconButton><IconButton label="Center image" title="Center image" active={!imageAttributes.alignment || imageAttributes.alignment === 'center'} onClick={() => runAtSelection(() => editor.chain().focus().updateAttributes('image', { alignment: 'center' }).run())}><AlignCenter size={16} /></IconButton><IconButton label="Align image right" title="Align image right" active={imageAttributes.alignment === 'right'} onClick={() => runAtSelection(() => editor.chain().focus().updateAttributes('image', { alignment: 'right' }).run())}><AlignRight size={16} /></IconButton><IconButton label="Remove image" title="Remove image" onClick={() => runAtSelection(() => editor.chain().focus().deleteSelection().run())}><X size={16} /></IconButton></>}
        <IconButton label="Insert table" title="Insert 3 by 3 table" active={tableActive} onClick={() => runAtSelection(() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())}><CheckSquare size={16} /></IconButton>
      </div>
      )}
      <EditorContent editor={editor} className="content-editor" />
    </div>
  );
}
