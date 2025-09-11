import React, { useState, useRef, useEffect } from 'react';

interface EditableTextProps {
  text: string;
  onSave: (newText: string) => void;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  className?: string;
  placeholder?: string;
}

export function EditableText({
  text,
  onSave,
  isEditing,
  onStartEdit,
  onCancelEdit,
  className = '',
  placeholder = 'Digite o texto...'
}: EditableTextProps) {
  const [editText, setEditText] = useState(text);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditText(text);
  }, [text]);

  const handleSave = () => {
    if (editText.trim()) {
      onSave(editText.trim());
    } else {
      setEditText(text); // Restaurar texto original se vazio
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditText(text);
      onCancelEdit();
    }
  };

  const handleBlur = () => {
    handleSave();
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editText}
        onChange={(e) => setEditText(e.target.value)}
        onKeyDown={handleKeyPress}
        onBlur={handleBlur}
        className={`bg-white border border-blue-500 rounded px-2 py-1 text-center outline-none ${className}`}
        placeholder={placeholder}
        style={{ minWidth: '80px', maxWidth: '200px' }}
      />
    );
  }

  return (
    <div
      onDoubleClick={onStartEdit}
      className={`cursor-text hover:bg-opacity-80 transition-colors ${className}`}
      title="Clique duplo para editar"
    >
      {text || placeholder}
    </div>
  );
} 