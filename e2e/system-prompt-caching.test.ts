import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import {
  createTestClient,
  createTestProject,
  createTestServer,
  createProject,
  createSession,
  type TestClient,
  type TestProject,
  type TestServerHandle,
} from './utils/index.js'

describe('System Prompt Caching', () => {
  let server: TestServerHandle
  let client: TestClient
  let project: TestProject

  beforeAll(async () => {
    server = await createTestServer()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(async () => {
    client = await createTestClient({ url: server.wsUrl })
    project = await createTestProject({ template: 'typescript' })
  })

  afterEach(async () => {
    await client.close()
    await project.cleanup()
  })

  async function fetchSession(sessionId: string) {
    const res = await fetch(`${server.url}/api/sessions/${sessionId}`)
    return res.json() as unknown as {
      session: {
        executionState: {
          cachedSystemPrompt?: string
          dynamicContextHash?: string
          dynamicContextChanged?: boolean
        } | null
      }
      contextState: { dynamicContextChanged: boolean }
    }
  }

  async function updateProjectInstructions(projectId: string, instructions: string) {
    const res = await fetch(`${server.url}/api/projects/${projectId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customInstructions: instructions }),
    })
    return res.json()
  }

  it('caches system prompt and detects changes to project instructions', async () => {
    const restProject = await createProject(server.url, { name: 'test', workdir: project.path })
    const restSession = await createSession(server.url, { projectId: restProject.id })
    await client.send('session.load', { sessionId: restSession.id })

    // Send first message — system prompt gets cached
    await client.send('chat.send', { content: 'Hello' })
    await client.waitForChatDone()

    const state1 = await fetchSession(restSession.id)
    const firstHash = state1.session.executionState?.dynamicContextHash
    const firstPrompt = state1.session.executionState?.cachedSystemPrompt
    expect(firstHash).toBeTruthy()
    expect(firstPrompt).toBeTruthy()
    expect(state1.contextState.dynamicContextChanged).toBe(false)

    // Update project instructions
    await updateProjectInstructions(restProject.id, 'Use functional programming style')

    // Send second message — hash should differ, but cached prompt should still be used
    await client.send('chat.send', { content: 'Do something' })
    await client.waitForChatDone()

    const state2 = await fetchSession(restSession.id)
    expect(state2.session.executionState?.cachedSystemPrompt).toBe(firstPrompt)
    expect(state2.session.executionState?.dynamicContextHash).toBe(firstHash)
    expect(state2.contextState.dynamicContextChanged).toBe(true)

    // Apply dynamic context — ack is sent after work completes
    await client.send('context.applyDynamic', {})

    const state3 = await fetchSession(restSession.id)
    expect(state3.session.executionState?.cachedSystemPrompt).toContain('functional programming')
    expect(state3.session.executionState?.dynamicContextHash).not.toBe(firstHash)
    expect(state3.contextState.dynamicContextChanged).toBe(false)
  })
})
