import type { DiffFileData } from "@/types/diff"

export interface PRFileTreeFolderNode {
  type: "folder"
  path: string
  name: string
  children: PRFileTreeNode[]
}

export interface PRFileTreeFileNode {
  type: "file"
  path: string
  name: string
  file: DiffFileData
}

export type PRFileTreeNode = PRFileTreeFolderNode | PRFileTreeFileNode

/**
 * Compact linear folder chains into a single display node.
 * Example: app/javascript/core -> one folder node named "app/javascript/core".
 */
function compactFolderNode(node: PRFileTreeFolderNode): PRFileTreeFolderNode {
  const compactedNameSegments = [node.name]
  let terminalNode = node

  while (
    terminalNode.children.length === 1 &&
    terminalNode.children[0].type === "folder"
  ) {
    const onlyChild = terminalNode.children[0]
    compactedNameSegments.push(onlyChild.name)
    terminalNode = onlyChild
  }

  return {
    type: "folder",
    path: terminalNode.path,
    name: compactedNameSegments.join("/"),
    children: terminalNode.children.map((child) =>
      child.type === "folder" ? compactFolderNode(child) : child
    ),
  }
}

function compactTree(nodes: PRFileTreeNode[]): PRFileTreeNode[] {
  return nodes.map((node) =>
    node.type === "folder" ? compactFolderNode(node) : node
  )
}

/**
 * Build a hierarchical file tree from flat diff file paths.
 * Folders are sorted before files, then alphabetically by name.
 */
export function buildPRFileTree(files: DiffFileData[]): PRFileTreeNode[] {
  const root: Map<string, PRFileTreeNode> = new Map()
  const folderNodes: Map<string, PRFileTreeFolderNode> = new Map()

  // Helper to get or create folder at a given path
  function getOrCreateFolder(folderPath: string): PRFileTreeFolderNode {
    if (folderNodes.has(folderPath)) {
      return folderNodes.get(folderPath)!
    }

    const segments = folderPath.split("/")
    const name = segments[segments.length - 1]
    const folder: PRFileTreeFolderNode = {
      type: "folder",
      path: folderPath,
      name,
      children: [],
    }
    folderNodes.set(folderPath, folder)

    // If this folder has a parent, add it to the parent's children
    if (segments.length > 1) {
      const parentPath = segments.slice(0, -1).join("/")
      const parent = getOrCreateFolder(parentPath)
      // Check if already added
      if (!parent.children.some((c) => c.path === folderPath)) {
        parent.children.push(folder)
      }
    } else {
      // This is a root-level folder
      root.set(folderPath, folder)
    }

    return folder
  }

  // Process each file
  for (const file of files) {
    const segments = file.path.split("/")
    const fileName = segments[segments.length - 1]

    const fileNode: PRFileTreeFileNode = {
      type: "file",
      path: file.path,
      name: fileName,
      file,
    }

    if (segments.length === 1) {
      // File at root level
      root.set(file.path, fileNode)
    } else {
      // File in a folder
      const folderPath = segments.slice(0, -1).join("/")
      const folder = getOrCreateFolder(folderPath)
      folder.children.push(fileNode)
    }
  }

  // Sort function: folders before files, then alphabetically
  function sortNodes(nodes: PRFileTreeNode[]): PRFileTreeNode[] {
    return nodes.sort((a, b) => {
      // Folders come first
      if (a.type === "folder" && b.type === "file") return -1
      if (a.type === "file" && b.type === "folder") return 1
      // Then sort alphabetically by name
      return a.name.localeCompare(b.name)
    })
  }

  // Recursively sort all folders
  function sortTree(nodes: PRFileTreeNode[]): PRFileTreeNode[] {
    const sorted = sortNodes(nodes)
    for (const node of sorted) {
      if (node.type === "folder") {
        node.children = sortTree(node.children)
      }
    }
    return sorted
  }

  return compactTree(sortTree(Array.from(root.values())))
}

/**
 * Get all folder paths for default expansion (all levels expanded).
 */
export function getDefaultExpandedFolders(nodes: PRFileTreeNode[]): Set<string> {
  const expanded = new Set<string>()

  function collectFolders(nodeList: PRFileTreeNode[]) {
    for (const node of nodeList) {
      if (node.type === "folder") {
        expanded.add(node.path)
        collectFolders(node.children)
      }
    }
  }

  collectFolders(nodes)
  return expanded
}
