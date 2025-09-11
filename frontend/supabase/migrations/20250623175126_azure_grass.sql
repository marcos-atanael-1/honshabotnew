/*
  # Add image field to clientes table

  1. Changes
    - Add `imagem_url` column to `clientes` table (optional text field)
    - This will store the URL/path to the client's image

  2. Notes
    - Field is optional (nullable)
    - Will store image URLs or file paths
*/

-- Add image URL column to clientes table
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS imagem_url text;