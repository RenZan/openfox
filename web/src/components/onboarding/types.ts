import type { Backend } from '../../stores/config'
export { getBackendDisplayName } from '../../stores/config'

export interface ProviderInfo {
  id: string
  name: string
  url: string
  backend: Backend
  model: string | null
  apiKey?: string
  isLocal?: boolean
}
