import axios from 'axios'
import { HighlightType, Page } from '../../elastic/types'
import { Integration } from '../../entity/integration'
import { getRepository } from '../../entity/utils'
import { env } from '../../env'
import { wait } from '../../utils/helpers'
import { logger } from '../../utils/logger'
import { getHighlightUrl } from '../highlights'
import { IntegrationService } from './integration'

interface ReadwiseHighlight {
  // The highlight text, (technically the only field required in a highlight object)
  text: string
  // The title of the page the highlight is on
  title?: string
  // The author of the page the highlight is on
  author?: string
  // The URL of the page image
  image_url?: string
  // The URL of the page
  source_url?: string
  // A meaningful unique identifier for your app
  source_type?: string
  // One of: books, articles, tweets or podcasts
  category?: string
  // Annotation note attached to the specific highlight
  note?: string
  // Highlight's location in the source text. Used to order the highlights
  location?: number
  // One of: page, order or time_offset
  location_type?: string
  // A datetime representing when the highlight was taken in the ISO 8601 format
  highlighted_at?: string
  // Unique url of the specific highlight
  highlight_url?: string
}

export const READWISE_API_URL = 'https://readwise.io/api/v2'

export class ReadwiseIntegration extends IntegrationService {
  name = 'READWISE'
  accessToken = async (token: string): Promise<string | null> => {
    const authUrl = `${env.readwise.apiUrl || READWISE_API_URL}/auth`
    try {
      const response = await axios.get(authUrl, {
        headers: {
          Authorization: `Token ${token}`,
        },
      })
      return response.status === 204 ? token : null
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error(error.response)
      } else {
        logger.error(error)
      }
      return null
    }
  }
  export = async (
    integration: Integration,
    pages: Page[]
  ): Promise<boolean> => {
    let result = true

    const highlights = pages.flatMap(this.pageToReadwiseHighlight)
    // If there are no highlights, we will skip the sync
    if (highlights.length > 0) {
      result = await this.syncWithReadwise(integration.token, highlights)
    }

    // update integration syncedAt if successful
    if (result) {
      logger.info('updating integration syncedAt')
      await getRepository(Integration).update(integration.id, {
        syncedAt: new Date(),
      })
    }
    return result
  }

  pageToReadwiseHighlight = (page: Page): ReadwiseHighlight[] => {
    const { highlights } = page
    if (!highlights) return []
    const category = page.siteName === 'Twitter' ? 'tweets' : 'articles'
    return highlights
      .map((highlight) => {
        // filter out highlights that are not of type highlight or have no quote
        if (highlight.type !== HighlightType.Highlight || !highlight.quote) {
          return undefined
        }

        return {
          text: highlight.quote,
          title: page.title,
          author: page.author || undefined,
          highlight_url: getHighlightUrl(page.slug, highlight.id),
          highlighted_at: new Date(highlight.createdAt).toISOString(),
          category,
          image_url: page.image || undefined,
          // location: highlight.highlightPositionAnchorIndex || undefined,
          location_type: 'order',
          note: highlight.annotation || undefined,
          source_type: 'omnivore',
          source_url: page.url,
        }
      })
      .filter((highlight) => highlight !== undefined) as ReadwiseHighlight[]
  }

  syncWithReadwise = async (
    token: string,
    highlights: ReadwiseHighlight[],
    retryCount = 0
  ): Promise<boolean> => {
    const url = `${env.readwise.apiUrl || READWISE_API_URL}/highlights`
    try {
      const response = await axios.post(
        url,
        {
          highlights,
        },
        {
          headers: {
            Authorization: `Token ${token}`,
            ContentType: 'application/json',
          },
        }
      )
      return response.status === 200
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429 && retryCount < 3) {
          logger.info('Readwise API rate limit exceeded, retrying...')
          // wait for Retry-After seconds in the header if rate limited
          // max retry count is 3
          const retryAfter = error.response?.headers['retry-after'] || '10' // default to 10 seconds
          await wait(parseInt(retryAfter, 10) * 1000)
          return this.syncWithReadwise(token, highlights, retryCount + 1)
        }

        logger.error(error.response)
      } else {
        logger.error(error)
      }

      return false
    }
  }
}
