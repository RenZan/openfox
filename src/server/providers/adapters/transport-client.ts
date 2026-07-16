import type { Provider } from '../../../shared/types.js'
import { getBackendCapabilities, type Backend } from '../../llm/backend.js'
import { getModelProfile } from '../../llm/profiles.js'
import type { LLMClientWithModel } from '../../llm/client.js'
import type { ProviderTransportAdapter, ProviderRequestContext, ProviderAccessContext } from '../../../provider/index.js'
import { logger } from '../../utils/logger.js'

export function createTransportLLMClient(
  provider: Provider,
  modelId: string,
  transport: ProviderTransportAdapter,
  resolveAuth?: () => Promise<ProviderAccessContext>,
): LLMClientWithModel {
  let model = modelId
  let backend = provider.backend as Backend
  const profileFor = (id: string) => {
    const base = getModelProfile(id)
    const configured = provider.models.find((item) => item.id === id)
    return {
      ...base,
      ...(configured?.defaultTemperature !== undefined && { temperature: configured.defaultTemperature }),
      ...(configured?.defaultTopP !== undefined && { topP: configured.defaultTopP }),
      ...(configured?.defaultTopK !== undefined && { topK: configured.defaultTopK }),
      ...(configured?.defaultMaxTokens !== undefined && { defaultMaxTokens: configured.defaultMaxTokens }),
      ...(configured?.supportsVision !== undefined && { supportsVision: configured.supportsVision }),
    }
  }
  let profile = profileFor(model)
  void getBackendCapabilities(backend)

  const context = async (): Promise<ProviderRequestContext> => {
    const configured = provider.models.find((item) => item.id === model)
    const ctx: ProviderRequestContext = {
      providerId: provider.id,
      model: configured?.apiModelId ?? model,
      catalogModel: model,
      ...(configured?.requestBody && { requestBody: configured.requestBody }),
      ...(provider.credentialRef && { credentialRef: provider.credentialRef }),
    }
    if (resolveAuth) {
      try {
        ctx.auth = await resolveAuth()
      } catch (error) {
        logger.debug('Auth resolution failed for transport client', { providerId: provider.id, error: String(error) })
      }
    }
    return ctx
  }

  return {
    getModel: () => model,
    setModel(next) {
      model = next
      profile = profileFor(next)
    },
    getProfile: () => profile,
    getBackend: () => backend,
    setBackend(next) {
      backend = next
    },
    complete: async (request) => transport.complete(request, await context()),
    stream: async function* (request) { yield* transport.stream(request, await context()) },
  }
}
