import { describe, expect, it, vi, beforeEach } from 'vitest'
import { McpManager } from './manager.js'
import { createMcpTools } from './tool-adapter.js'

// Mock the MCP SDK Client
const mockClientInstance = {
  connect: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
  listTools: vi.fn().mockResolvedValue({
    tools: [
      {
        name: 'get_weather',
        description: 'Get weather',
        inputSchema: { type: 'object', properties: { location: { type: 'string' } } },
      },
      {
        name: 'write_file',
        description: 'Write file',
        inputSchema: { type: 'object', properties: { path: { type: 'string' } } },
      },
    ],
  }),
  callTool: vi.fn().mockResolvedValue({
    content: [{ type: 'text', text: 'Sunny, 72°F' }],
    isError: false,
  }),
}

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: vi.fn(function () {
    return mockClientInstance
  }),
}))

const mockTransportInstance = {
  start: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
}

vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: vi.fn(function () {
    return mockTransportInstance
  }),
}))

const mockHttpTransportInstance = {
  start: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
}

vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: vi.fn(function () {
    return mockHttpTransportInstance
  }),
}))

describe('McpManager', () => {
  let manager: McpManager

  beforeEach(() => {
    manager = new McpManager()
  })

  describe('addServer', () => {
    it('should connect to a stdio server and discover tools', async () => {
      await manager.addServer('test-server', {
        transport: 'stdio',
        command: 'node',
        args: ['server.js'],
      })

      const server = manager.getServer('test-server')
      expect(server).toBeDefined()
      expect(server!.status).toBe('connected')
      expect(server!.tools).toHaveLength(2)
      expect(server!.tools[0]!.name).toBe('get_weather')
      expect(server!.tools[1]!.name).toBe('write_file')
    })

    it('should reject duplicate server names', async () => {
      await manager.addServer('test', { transport: 'stdio', command: 'node' })
      await expect(manager.addServer('test', { transport: 'stdio', command: 'node' })).rejects.toThrow('already exists')
    })

    it('should connect to an HTTP server and discover tools', async () => {
      await manager.addServer('http-server', {
        transport: 'http',
        url: 'https://mcp.example.com/mcp',
        headers: { 'X-API-Key': 'secret123' },
      })

      const server = manager.getServer('http-server')
      expect(server).toBeDefined()
      expect(server!.status).toBe('connected')
      expect(server!.tools).toHaveLength(2)
      expect(server!.tools[0]!.name).toBe('get_weather')

      const { StreamableHTTPClientTransport } = await import('@modelcontextprotocol/sdk/client/streamableHttp.js')
      expect(StreamableHTTPClientTransport).toHaveBeenCalledWith(
        new URL('https://mcp.example.com/mcp'),
        expect.objectContaining({
          requestInit: expect.objectContaining({
            headers: { 'X-API-Key': 'secret123' },
          }),
        }),
      )
    })

    it('should set server to error state when HTTP transport is missing url', async () => {
      await manager.addServer('bad-http', {
        transport: 'http',
      } as any)

      const server = manager.getServer('bad-http')
      expect(server).toBeDefined()
      expect(server!.status).toBe('error')
      expect(server!.error).toContain('url is required')
    })

    it('should apply disabledTools filter', async () => {
      await manager.addServer('test', {
        transport: 'stdio',
        command: 'node',
        disabledTools: ['write_file'],
      })

      const server = manager.getServer('test')
      expect(server!.tools.find((t) => t.name === 'write_file')!.enabled).toBe(false)
      expect(server!.tools.find((t) => t.name === 'get_weather')!.enabled).toBe(true)
    })
  })

  describe('removeServer', () => {
    it('should remove a server and its tools', async () => {
      await manager.addServer('test', { transport: 'stdio', command: 'node' })
      expect(manager.getServer('test')).toBeDefined()

      manager.removeServer('test')
      expect(manager.getServer('test')).toBeUndefined()
    })
  })

  describe('getToolDefinitions', () => {
    it('should return prefixed tool definitions for enabled tools only', async () => {
      await manager.addServer('srv', {
        transport: 'stdio',
        command: 'node',
        disabledTools: ['write_file'],
      })

      const defs = manager.getToolDefinitions()
      expect(defs).toHaveLength(1)
      expect(defs[0]!.function.name).toBe('srv_get_weather')
    })
  })

  describe('callTool', () => {
    it('should call a tool and return the result', async () => {
      await manager.addServer('test', { transport: 'stdio', command: 'node' })

      const result = await manager.callTool('test', 'get_weather', { location: 'Paris' })
      expect(result.success).toBe(true)
      expect(result.output).toBe('Sunny, 72°F')
    })

    it('should return error for unknown server', async () => {
      const result = await manager.callTool('unknown', 'tool', {})
      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })
  })

  describe('setToolEnabled', () => {
    it('should toggle tool enabled state', async () => {
      await manager.addServer('test', { transport: 'stdio', command: 'node' })

      await manager.setToolEnabled('test', 'get_weather', false)
      const server = manager.getServer('test')
      expect(server!.tools.find((t) => t.name === 'get_weather')!.enabled).toBe(false)

      await manager.setToolEnabled('test', 'get_weather', true)
      expect(server!.tools.find((t) => t.name === 'get_weather')!.enabled).toBe(true)
    })
  })

  describe('getToolFingerprint', () => {
    it('should return a sorted comma-separated list of enabled tools', async () => {
      await manager.addServer('b', { transport: 'stdio', command: 'node' })
      await manager.addServer('a', { transport: 'stdio', command: 'node', disabledTools: ['write_file'] })

      const fp = manager.getToolFingerprint()
      expect(fp).toBe('a:get_weather,b:get_weather,b:write_file')
    })
  })
})

describe('createMcpTools', () => {
  it('should create Tool objects from MCP manager', async () => {
    const manager = new McpManager()
    await manager.addServer('test', { transport: 'stdio', command: 'node' })

    const tools = createMcpTools(manager)
    expect(tools).toHaveLength(2)
    expect(tools[0]!.name).toBe('test_get_weather')
    expect(tools[1]!.name).toBe('test_write_file')
    expect(tools[0]!.definition.function.name).toBe('test_get_weather')
  })

  it('should skip disabled tools', async () => {
    const manager = new McpManager()
    await manager.addServer('test', { transport: 'stdio', command: 'node', disabledTools: ['write_file'] })

    const tools = createMcpTools(manager)
    expect(tools).toHaveLength(1)
    expect(tools[0]!.name).toBe('test_get_weather')
  })

  it('should execute tool calls through the manager', async () => {
    const manager = new McpManager()
    await manager.addServer('test', { transport: 'stdio', command: 'node' })

    const tools = createMcpTools(manager)
    const result = await tools[0]!.execute({ location: 'Paris' }, {} as any)
    expect(result.success).toBe(true)
    expect(result.output).toBe('Sunny, 72°F')
  })
})

describe('estimateToolTokens', () => {
  it('should return a positive token estimate for a tool definition', async () => {
    const { estimateToolTokens } = await import('./manager.js')
    const tokens = estimateToolTokens('test_tool', 'A test tool', {
      type: 'object',
      properties: { name: { type: 'string' } },
    })
    expect(tokens).toBeGreaterThan(0)
    expect(Number.isInteger(tokens)).toBe(true)
  })

  it('should return larger estimates for tools with complex schemas', async () => {
    const { estimateToolTokens } = await import('./manager.js')
    const simple = estimateToolTokens('simple', 'Simple', { type: 'object' })
    const complex = estimateToolTokens('complex', 'Complex', {
      type: 'object',
      properties: {
        a: { type: 'string', description: 'A field' },
        b: { type: 'number', description: 'B field' },
        c: { type: 'boolean' },
      },
      required: ['a', 'b'],
    })
    expect(complex).toBeGreaterThan(simple)
  })
})

describe('McpManager token estimation', () => {
  it('should populate estimatedTokens on tools after connection', async () => {
    const manager = new McpManager()
    await manager.addServer('test', { transport: 'stdio', command: 'node' })

    const server = manager.getServer('test')
    expect(server).toBeDefined()
    expect(server!.estimatedTokens).toBeGreaterThan(0)
    for (const tool of server!.tools) {
      expect(tool.estimatedTokens).toBeGreaterThan(0)
    }
  })

  it('should update estimatedTokens when tools are disabled', async () => {
    const manager = new McpManager()
    await manager.addServer('test', { transport: 'stdio', command: 'node' })

    const before = manager.getServer('test')!.estimatedTokens
    await manager.setToolEnabled('test', 'get_weather', false)
    const after = manager.getServer('test')!.estimatedTokens

    expect(after).toBeLessThan(before)
  })
})
