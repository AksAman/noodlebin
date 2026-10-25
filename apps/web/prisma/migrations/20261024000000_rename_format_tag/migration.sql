-- Rename the clipboard format tag from "nodevault.tree" to "noodlebin.tree"
-- in every stored post payload.
UPDATE posts
SET tree = jsonb_set(tree::jsonb, '{format}', '"noodlebin.tree"')
WHERE tree->>'format' = 'nodevault.tree';
