import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Data, View } from '../types'
import * as m from './model'

const PANE = 'conversation-folders'

const data = atom({ plugin: 'conversation-folders', key: 'data' } as const, m.empty)
const view = atom({ plugin: 'conversation-folders', key: 'view' } as const, 'tree' as View)
const open = atom({ plugin: 'conversation-folders', key: 'open' } as const, [] as string[])
const naming = atom({ plugin: 'conversation-folders', key: 'naming' } as const, false)
const moving = atom({ plugin: 'conversation-folders', key: 'moving' } as const, false)

/** Applies a change to the folder data and keeps it past the session. */
async function change($: EngineInterface, fn: (d: Data) => Data): Promise<Data> {
  const next = await update($, data, d => fn(d ?? m.empty))
  await $.store.set('data', next)
  return next
}

async function showPane($: EngineInterface) {
  await $.store.set('classic', false)
  await $.ui.open({ id: PANE, title: 'Folders' })
}

async function hidePane($: EngineInterface) {
  await $.store.set('classic', true)
  await $.ui.close({ id: PANE })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'folders', description: 'Show the conversation folders pane' })
    await $.command.register({
      name: 'folder',
      description: 'File this conversation: /folder <name> (creates it if new), or /folder to pick',
    })
    await $.command.register({ name: 'classic', description: 'Hide the folders pane (classic view)' })

    const saved = m.normalize(await $.store.get('data'))
    await update($, data, () => saved)

    if ((await $.store.get('classic')) !== true) {
      void $.ui.open({ id: PANE, title: 'Folders' })
    }

    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    try {
      if (!e.text.trim().startsWith('/')) {
        const id = await $.session.id()
        await change($, d => m.upsertChat(d, id, e.text, Date.now()))
      }
    } catch {
      // Filing is best-effort: never hold up the person's prompt.
    }

    return next(e)
  })

  on('command.run', { command: 'folders' }, async $ => {
    await showPane($)
    return { text: 'Folders pane opened.' }
  })

  on('command.run', { command: 'classic' }, async $ => {
    await hidePane($)
    return { text: 'Classic view. Run /folders to bring the pane back.' }
  })

  on('command.run', { command: 'folder' }, async ($, e) => {
    const id = await $.session.id()
    const name = e.args.trim()

    if (name === '') {
      await showPane($)
      await update($, moving, () => true)
      return { text: 'Pick a folder in the pane.' }
    }

    let d = await read($, data)
    d = m.upsertChat(d, id, 'Untitled chat', Date.now())
    let folder = m.findFolder(d, name)
    if (!folder) {
      d = m.addFolder(d, name, `f${Date.now().toString(36)}`)
      folder = m.findFolder(d, name)
    }
    if (!folder) return { text: 'Give the folder a name.' }

    const target = folder
    await change($, () => m.fileChat(d, id, target.id))
    return { text: `Filed in ${target.name}.` }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Input } = $.ui.resolve(e)
    const d = await read($, data)
    const mode = await read($, view)
    const expanded = await read($, open)
    const isNaming = await read($, naming)
    const isMoving = await read($, moving)

    const toggleOpen = (id: string) =>
      update($, open, o => (o.includes(id) ? o.filter(x => x !== id) : [...o, id]))

    const copyResume = (id: string, surface: string) =>
      $.ui.copy({ text: `claude --resume ${id}`, surface: surface as never })

    const chatRow = (c: Data['chats'][number], pad: number) => (
      <Box key={`row:${c.id}`} paddingLeft={pad}>
        <Button
          key={`chat:${c.id}`}
          label={c.title}
          plain
          onPress={p => {
            void copyResume(c.id, p.surface)
            $.ui.toast('Resume command copied')
          }}
        />
        <Text> </Text>
        <Button
          key={`pinchat:${c.id}`}
          label={c.pinned ? '★' : '☆'}
          plain
          onPress={() => void change($, x => m.togglePinChat(x, c.id))}
        />
      </Box>
    )

    const pinnedFolders = d.folders.filter(f => f.pinned)
    const pinnedChats = d.chats.filter(c => c.pinned)
    const unfiled = m.inFolder(d, null)

    const header = (
      <Box key="header" flexDirection="row" gap={1}>
        <Text bold>Folders</Text>
        <Button
          key="view"
          label={mode === 'tree' ? 'Home' : 'Tree'}
          onPress={() => void update($, view, v => (v === 'tree' ? 'home' : 'tree'))}
        />
        <Button key="new" label="+ Folder" onPress={() => void update($, naming, () => true)} />
        <Button key="classic" label="Classic" onPress={() => void hidePane($)} />
      </Box>
    )

    const naming$ = isNaming ? (
      <Input
        key="name"
        label="Name: "
        placeholder="New folder"
        autoFocus
        onSubmit={value => {
          void change($, x => m.addFolder(x, value, `f${Date.now().toString(36)}`))
          void update($, naming, () => false)
        }}
      />
    ) : null

    const picker = isMoving ? (
      <Box key="picker" flexDirection="column" borderStyle="round" paddingX={1}>
        <Text bold>File this conversation in:</Text>
        {d.folders.map(f => (
          <Button
            key={`move:${f.id}`}
            label={f.name}
            plain
            onPress={async () => {
              const id = await $.session.id()
              await change($, x => m.fileChat(m.upsertChat(x, id, 'Untitled chat', Date.now()), id, f.id))
              await update($, moving, () => false)
            }}
          />
        ))}
        <Button
          key="move:none"
          label="Unfile"
          plain
          onPress={async () => {
            const id = await $.session.id()
            await change($, x => m.fileChat(x, id, null))
            await update($, moving, () => false)
          }}
        />
        <Button key="move:cancel" label="Cancel" plain onPress={() => void update($, moving, () => false)} />
      </Box>
    ) : null

    const pinned =
      pinnedFolders.length + pinnedChats.length === 0 ? null : (
        <Box key="pinned" flexDirection="column">
          <Text dimColor>PINNED</Text>
          {pinnedFolders.map(f => (
            <Button
              key={`pinfolder:${f.id}`}
              label={`${f.name} (${m.inFolder(d, f.id).length})`}
              plain
              onPress={() => void toggleOpen(f.id)}
            />
          ))}
          {pinnedChats.map(c => chatRow(c, 0))}
        </Box>
      )

    const empty =
      d.folders.length === 0 ? (
        <Text dimColor>No folders yet. Press + Folder, or run /folder Name inside a chat.</Text>
      ) : null

    if (mode === 'home') {
      return (
        <Box flexDirection="column" gap={1}>
          {header}
          {naming$}
          {picker}
          {pinned}
          {empty}
          <Box key="cards" flexDirection="row" flexWrap="wrap" gap={1}>
            {d.folders.map(f => (
              <Box key={`card:${f.id}`} flexDirection="column" borderStyle="round" borderColor={f.color} paddingX={1} width={26}>
                <Box flexDirection="row" gap={1}>
                  <Text bold color={f.color}>{f.name}</Text>
                  <Text dimColor>{m.inFolder(d, f.id).length}</Text>
                  <Button
                    key={`pinf:${f.id}`}
                    label={f.pinned ? '★' : '☆'}
                    plain
                    onPress={() => void change($, x => m.togglePinFolder(x, f.id))}
                  />
                </Box>
                {m.inFolder(d, f.id).slice(0, 2).map(c => (
                  <Text key={`peek:${c.id}`} dimColor wrap="truncate-end">{c.title}</Text>
                ))}
              </Box>
            ))}
          </Box>
          <Box key="recent" flexDirection="column">
            <Text dimColor>RECENT CHATS</Text>
            {m.recent(d, 8).map(c => chatRow(c, 0))}
          </Box>
        </Box>
      )
    }

    return (
      <Box flexDirection="column" gap={1}>
        {header}
        {naming$}
        {picker}
        {pinned}
        {empty}
        <Box key="tree" flexDirection="column">
          {d.folders.map(f => {
            const isOpen = expanded.includes(f.id)
            return (
              <Box key={`tree:${f.id}`} flexDirection="column">
                <Box flexDirection="row" gap={1}>
                  <Button
                    key={`fold:${f.id}`}
                    label={`${isOpen ? '▾' : '▸'} ${f.name} (${m.inFolder(d, f.id).length})`}
                    plain
                    onPress={() => void toggleOpen(f.id)}
                  />
                  <Button
                    key={`pinfold:${f.id}`}
                    label={f.pinned ? '★' : '☆'}
                    plain
                    onPress={() => void change($, x => m.togglePinFolder(x, f.id))}
                  />
                  <Button
                    key={`del:${f.id}`}
                    label="✕"
                    plain
                    onPress={() => void change($, x => m.removeFolder(x, f.id))}
                  />
                </Box>
                {isOpen && m.inFolder(d, f.id).map(c => chatRow(c, 2))}
              </Box>
            )
          })}
        </Box>
        <Box key="unfiled" flexDirection="column">
          <Text dimColor>UNFILED ({unfiled.length})</Text>
          {unfiled.slice(0, 10).map(c => chatRow(c, 0))}
        </Box>
      </Box>
    )
  })
}
