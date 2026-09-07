/**
 * Write one text file under the open folder, creating the folders on the way. Used for
 * pages the app itself composes (an answer filed back); pages an agent writes go through
 * the agent's own tools. Whole-file write, as `appendWikiLog` does: a partial write is
 * what leaves a torn page.
 */
export async function writeWikiFile(
  vault: FileSystemDirectoryHandle,
  relPath: string,
  text: string,
): Promise<void> {
  const parts = relPath.split("/").filter(Boolean);
  const fileName = parts.pop();
  if (!fileName) throw new Error("a file needs a name");
  let dir = vault;
  for (const part of parts) dir = await dir.getDirectoryHandle(part, { create: true });
  const file = await dir.getFileHandle(fileName, { create: true });
  const writable = await file.createWritable();
  await writable.write(text);
  await writable.close();
}
