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
import {
  AlignLeft,
  Bold,
  BetweenVerticalStart,
  CheckSquare,
  ChevronDown,
  Eraser,
  Highlighter,
  ImagePlus,
  Indent,
  Italic,
  Link2,
  List,
  ListOrdered,
  ListTodo,
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
} from 'lucide-react';

const TextFormatting = Extension.create({
  name: 'textFormatting',
  addGlobalAttributes() {
    return [{
      types: ['textStyle'],
      attributes: {
        fontSize: {
          default: null,
          parseHTML: (element: HTMLElement) => element.style.fontSize || null,
          renderHTML: (attributes: { fontSize?: string | null }) => attributes.fontSize ? { style: `font-size: ${attributes.fontSize}` } : {},
        },
      },
    }, {
      types: ['paragraph', 'heading'],
      attributes: {
        lineHeight: {
          default: null,
          parseHTML: (element: HTMLElement) => element.style.lineHeight || null,
          renderHTML: (attributes: { lineHeight?: string | null }) => attributes.lineHeight ? { style: `line-height: ${attributes.lineHeight}` } : {},
        },
        indent: {
          default: 0,
          parseHTML: (element: HTMLElement) => Number(element.dataset.indent || 0),
          renderHTML: (attributes: { indent?: number }) => attributes.indent ? { style: `margin-left: ${attributes.indent * 2}rem`, 'data-indent': String(attributes.indent) } : {},
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

function IconButton({ label, title, active = false, disabled = false, onClick, children }: IconButtonProps) {
  return <button type="button" aria-label={label} title={title} aria-pressed={active} disabled={disabled} className={`${iconButton} ${active ? activeButton : ''} disabled:cursor-not-allowed disabled:opacity-35`} onMouseDown={(event) => event.preventDefault()} onClick={onClick}>{children}</button>;
}

function Divider() {
  return <span className="mx-1 h-5 w-px shrink-0 bg-slate-200" aria-hidden="true" />;
}

function ColorPalette({ label, value, onSelect, onClear, clearLabel }: { label: string; value?: string; onSelect: (color: string) => void; onClear?: () => void; clearLabel?: string }) {
  return <div className="w-48 rounded-md border border-slate-200 bg-white p-2 shadow-xl"><p className="px-1 pb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>{onClear && <button type="button" onClick={onClear} className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-xs text-slate-600 hover:bg-slate-100"><span className="grid h-4 w-4 place-items-center rounded border border-slate-300 text-[10px] leading-none">/</span>{clearLabel ?? 'None'}</button>}<div className="mt-1 grid grid-cols-10 gap-0.5">{colorSwatches.map((color) => <button type="button" key={color} aria-label={`Use ${color}`} title={color} onClick={() => onSelect(color)} className={`h-4 w-4 rounded-full border ${value?.toLowerCase() === color.toLowerCase() ? 'ring-2 ring-orange-400 ring-offset-1' : 'border-slate-200 hover:scale-110'}`} style={{ backgroundColor: color }} />)}</div><div className="mt-2 border-t border-slate-100 pt-2"><label className="flex items-center gap-2 px-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Custom<input aria-label={`Custom ${label}`} type="color" value={value || '#071b41'} onChange={(event) => onSelect(event.target.value)} className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0" /></label></div></div>;
}

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function ContentEditor({
  value,
  onChange,
  placeholder = 'Start writing event content...',
  onComment,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onComment?: (note: string) => void;
}) {
  const lastValue = useRef(value);
  const imageInput = useRef<HTMLInputElement>(null);
  const [, refresh] = useState(0);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [imageOpen, setImageOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [imageSearch, setImageSearch] = useState('');
  const [textColorOpen, setTextColorOpen] = useState(false);
  const [highlightColorOpen, setHighlightColorOpen] = useState(false);
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
      Link.configure({ openOnClick: false, autolink: true, defaultProtocol: 'https' }),
      Image.configure({ inline: false, allowBase64: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: value || '<p></p>',
    immediatelyRender: false,
    editorProps: { attributes: { 'data-placeholder': placeholder } },
    onUpdate: ({ editor: current }) => {
      lastValue.current = current.getHTML();
      onChange(lastValue.current);
      refresh((count) => count + 1);
    },
    onSelectionUpdate: () => refresh((count) => count + 1),
  });

  useEffect(() => {
    if (editor && value !== lastValue.current && value !== editor.getHTML()) {
      editor.commands.setContent(value || '<p></p>');
      lastValue.current = value;
    }
  }, [editor, value]);

  if (!editor) return <div className="min-h-[420px] rounded-b-lg border border-slate-200 p-4 text-sm text-slate-400">Loading editor...</div>;

  const textStyle = editor.getAttributes('textStyle') as { fontSize?: string; fontFamily?: string; color?: string };
  const selectedSize = Number.parseInt(textStyle.fontSize || '12', 10) || 12;
  const selectedFamily = textStyle.fontFamily || 'Arial';
  const highlightStyle = editor.getAttributes('highlight') as { color?: string };
  const currentNode = editor.isActive('heading', { level: 1 }) ? 'heading-1'
    : editor.isActive('heading', { level: 2 }) ? 'heading-2'
      : editor.isActive('heading', { level: 3 }) ? 'heading-3'
        : editor.isActive('heading', { level: 4 }) ? 'heading-4' : 'paragraph';
  const activeBlock = editor.isActive('heading') ? 'heading' : 'paragraph';
  const currentLineHeight = String(editor.getAttributes(activeBlock).lineHeight || '1.5');
  const currentAlignment = editor.getAttributes(activeBlock).textAlign || 'left';

  const setFontSize = (size: number) => editor.chain().focus().setMark('textStyle', { fontSize: `${Math.min(96, Math.max(6, size))}pt` }).run();
  const setLineHeight = (lineHeight: string) => {
    editor.chain().focus().updateAttributes(activeBlock, { lineHeight }).run();
  };
  const changeIndent = (delta: number) => {
    if (editor.isActive('listItem') || editor.isActive('taskItem')) {
      if (delta > 0) editor.chain().focus().sinkListItem('listItem').run();
      else editor.chain().focus().liftListItem('listItem').run();
      return;
    }
    const node = activeBlock;
    const current = Number(editor.getAttributes(node).indent || 0);
    editor.chain().focus().updateAttributes(node, { indent: Math.max(0, Math.min(8, current + delta)) }).run();
  };
  const addComment = () => {
    const note = window.prompt('Add a note');
    if (note?.trim()) {
      onComment?.(note.trim());
      editor.chain().focus().toggleBlockquote().insertContent(note.trim()).toggleBlockquote().run();
    }
  };
  const addImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => editor.chain().focus().setImage({ src: String(reader.result), alt: file.name }).run();
    reader.readAsDataURL(file);
  };
  const submitLink = () => {
    const href = normalizeUrl(linkUrl);
    if (href) editor.chain().focus().setLink({ href }).run();
    else editor.chain().focus().unsetLink().run();
    setLinkOpen(false);
  };
  const submitImageUrl = () => {
    const src = normalizeUrl(imageUrl);
    if (src) editor.chain().focus().setImage({ src, alt: 'Event content image' }).run();
    setImageUrl('');
    setImageOpen(false);
  };
  const tableActive = editor.isActive('table');

  return (
    <div className="relative overflow-visible rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-0.5 rounded-t-lg border-b border-slate-200 bg-slate-50 p-1.5">
        <IconButton label="Undo" title="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}><Undo2 size={16} /></IconButton>
        <IconButton label="Redo" title="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}><Redo2 size={16} /></IconButton>
        <Divider />
        <div className="relative"><select aria-label="Paragraph style" className={`${selectClass} min-w-28 appearance-none pr-7`} value={currentNode} onChange={(event) => {
          const style = event.target.value;
          if (style === 'paragraph') editor.chain().focus().setParagraph().run();
          else if (style === 'title') editor.chain().focus().setParagraph().setMark('textStyle', { fontSize: '26pt' }).toggleBold().run();
          else if (style === 'subtitle') editor.chain().focus().setParagraph().setMark('textStyle', { fontSize: '16pt' }).run();
          else editor.chain().focus().toggleHeading({ level: Number(style.replace('heading-', '')) as 1 | 2 | 3 | 4 }).run();
        }}><option value="paragraph">Normal text</option><option value="title">Title</option><option value="subtitle">Subtitle</option><option value="heading-1">Heading 1</option><option value="heading-2">Heading 2</option><option value="heading-3">Heading 3</option><option value="heading-4">Heading 4</option></select><ChevronDown className="pointer-events-none absolute right-1 top-2 text-slate-500" size={14} /></div>
        <div className="relative"><select aria-label="Font family" className={`${selectClass} min-w-28 appearance-none pr-7`} value={selectedFamily} onChange={(event) => editor.chain().focus().setFontFamily(event.target.value).run()}><option value="Arial">Arial</option><option value="Times New Roman">Times New Roman</option><option value="Georgia">Georgia</option><option value="Courier New">Courier New</option><option value="Roboto">Roboto</option><option value="Montserrat">Montserrat</option></select><ChevronDown className="pointer-events-none absolute right-1 top-2 text-slate-500" size={14} /></div>
        <div className="flex h-8 items-center overflow-hidden rounded-md border border-slate-300 bg-white shadow-sm"><button type="button" aria-label="Decrease font size" title="Decrease font size" onMouseDown={(event) => event.preventDefault()} onClick={() => setFontSize(selectedSize - 1)} className="grid h-full w-8 place-items-center text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"><Minus size={15} /></button><input aria-label="Font size" type="number" min="6" max="96" value={selectedSize} onChange={(event) => setFontSize(Number(event.target.value) || 12)} onBlur={(event) => setFontSize(Number(event.target.value) || 12)} className="h-full w-9 border-x border-slate-200 text-center text-xs font-semibold text-[#071b41] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" /><button type="button" aria-label="Increase font size" title="Increase font size" onMouseDown={(event) => event.preventDefault()} onClick={() => setFontSize(selectedSize + 1)} className="grid h-full w-8 place-items-center text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"><Plus size={15} /></button></div>
        <Divider />
        <IconButton label="Bold" title="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={16} /></IconButton>
        <IconButton label="Italic" title="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={16} /></IconButton>
        <IconButton label="Underline" title="Underline" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon size={16} /></IconButton>
        <div className="relative"><IconButton label="Text color" title="Text color" active={Boolean(textStyle.color)} onClick={() => { setTextColorOpen((open) => !open); setHighlightColorOpen(false); }}><span className="relative"><Type size={16} /><span className="absolute -bottom-1 left-0 h-0.5 w-4" style={{ backgroundColor: textStyle.color || '#071b41' }} /></span></IconButton>{textColorOpen && <div className="absolute left-0 top-10 z-30"><ColorPalette label="Text color" value={textStyle.color} onSelect={(color) => { editor.chain().focus().setColor(color).run(); setTextColorOpen(false); }} onClear={() => { editor.chain().focus().unsetColor().run(); setTextColorOpen(false); }} /></div>}</div>
        <div className="relative"><IconButton label="Highlight color" title="Highlight color" active={editor.isActive('highlight')} onClick={() => { setHighlightColorOpen((open) => !open); setTextColorOpen(false); }}><span className="relative"><Highlighter size={16} /><span className="absolute -bottom-1 left-0 h-0.5 w-4" style={{ backgroundColor: highlightStyle.color || '#facc15' }} /></span></IconButton>{highlightColorOpen && <div className="absolute left-0 top-10 z-30"><ColorPalette label="Highlight color" value={highlightStyle.color} onSelect={(color) => { editor.chain().focus().setHighlight({ color }).run(); setHighlightColorOpen(false); }} onClear={() => { editor.chain().focus().unsetHighlight().run(); setHighlightColorOpen(false); }} /></div>}</div>
        <Divider />
        <div className="relative"><IconButton label="Insert or edit link" title="Insert or edit link" active={editor.isActive('link')} onClick={() => { setLinkUrl(editor.getAttributes('link').href || ''); setLinkOpen((open) => !open); }}><Link2 size={16} /></IconButton>{linkOpen && <div className="absolute left-0 top-10 z-20 flex w-72 gap-2 rounded-lg border border-slate-200 bg-white p-2 shadow-lg"><input autoFocus value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') submitLink(); if (event.key === 'Escape') setLinkOpen(false); }} placeholder="https://example.com" className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:border-orange-400" /><button type="button" onClick={submitLink} className="rounded bg-orange-600 px-2 text-xs font-bold text-white">Apply</button></div>}</div>
        <IconButton label="Add note" title="Add note" onClick={addComment}><MessageSquarePlus size={16} /></IconButton>
        <div className="relative"><IconButton label="Insert image" title="Insert image" onClick={() => setImageOpen((open) => !open)}><ImagePlus size={16} /></IconButton>{imageOpen && <div className="absolute left-0 top-10 z-20 w-72 space-y-3 rounded-lg border border-slate-200 bg-white p-3 shadow-lg"><button type="button" onClick={() => imageInput.current?.click()} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-slate-50"><Upload size={15} />Upload from computer</button><div className="flex gap-2"><input value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="Paste image URL" className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:border-orange-400" /><button type="button" onClick={submitImageUrl} className="rounded bg-orange-600 px-2 text-xs font-bold text-white">Insert</button></div><div className="flex gap-2"><input value={imageSearch} onChange={(event) => setImageSearch(event.target.value)} placeholder="Search web images" className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:border-orange-400" /><button type="button" title="Open image search" onClick={() => { if (imageSearch.trim()) window.open(`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(imageSearch.trim())}`, '_blank', 'noopener,noreferrer'); }} className="rounded border border-slate-300 px-2 text-slate-700"><Search size={14} /></button></div></div>}</div>
        <input ref={imageInput} type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) addImageFile(file); event.currentTarget.value = ''; }} />
        <Divider />
        <div className="relative"><IconButton label="Alignment" title="Alignment" active={currentAlignment !== 'left'} onClick={() => editor.chain().focus().setTextAlign('left').run()}><AlignLeft size={16} /></IconButton><select aria-label="Text alignment" className="absolute inset-0 cursor-pointer opacity-0" value={currentAlignment} onChange={(event) => editor.chain().focus().setTextAlign(event.target.value).run()}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option><option value="justify">Justify</option></select></div>
        <div className="relative"><IconButton label="Line and paragraph spacing" title="Line and paragraph spacing" active={currentLineHeight !== '1.5'} onClick={() => setLineHeight('1.5')}><BetweenVerticalStart size={17} strokeWidth={1.8} /></IconButton><select aria-label="Line spacing" className="absolute inset-0 cursor-pointer opacity-0" value={currentLineHeight} onChange={(event) => setLineHeight(event.target.value)}><option value="1">Single</option><option value="1.15">1.15</option><option value="1.5">1.5</option><option value="2">Double</option></select></div>
        <IconButton label="Checklist" title="Checklist" active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()}><ListTodo size={16} /></IconButton>
        <IconButton label="Bulleted list" title="Bulleted list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={16} /></IconButton>
        <IconButton label="Numbered list" title="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={16} /></IconButton>
        <IconButton label="Decrease indent" title="Decrease indent" onClick={() => changeIndent(-1)}><Outdent size={16} /></IconButton>
        <IconButton label="Increase indent" title="Increase indent" onClick={() => changeIndent(1)}><Indent size={16} /></IconButton>
        <IconButton label="Clear formatting" title="Clear formatting" onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}><Eraser size={16} /></IconButton>
        {tableActive && <><Divider /><IconButton label="Add table row" title="Add table row" onClick={() => editor.chain().focus().addRowAfter().run()}><Plus size={15} /></IconButton><IconButton label="Delete table row" title="Delete table row" onClick={() => editor.chain().focus().deleteRow().run()}><Minus size={15} /></IconButton><IconButton label="Add table column" title="Add table column" onClick={() => editor.chain().focus().addColumnAfter().run()}><Plus size={15} /></IconButton><IconButton label="Delete table column" title="Delete table column" onClick={() => editor.chain().focus().deleteColumn().run()}><Minus size={15} /></IconButton></>}
        <IconButton label="Insert table" title="Insert 3 by 3 table" active={tableActive} onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><CheckSquare size={16} /></IconButton>
      </div>
      <EditorContent editor={editor} className="content-editor min-h-[420px] p-4" />
    </div>
  );
}
