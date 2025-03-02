import 'mocha'
import chai, { expect } from 'chai'
import { createTestUser, deleteTestUser } from '../db'
import sinonChai from 'sinon-chai'
import sinon from 'sinon'
import * as util from '../../src/utils/sendEmail'
import { MailDataRequired } from '@sendgrid/helpers/classes/mail'
import { User } from '../../src/entity/user'
import { getRepository } from '../../src/entity/utils'
import { ContentDisplayReport } from '../../src/entity/reports/content_display_report'
import { saveContentDisplayReport } from '../../src/services/reports'
import { ReportType } from '../../src/generated/graphql'
import { createTestElasticPage } from '../util'
import { Page } from '../../src/elastic/types'

chai.use(sinonChai)

describe('saveContentDisplayReport', () => {
  let user: User
  let page: Page

  before(async () => {
    user = await createTestUser('fakeContentUser')
    page = await createTestElasticPage(user.id)
  })

  after(async () => {
    await deleteTestUser(user.id)
  })

  it('creates a report', async () => {
    const result = await saveContentDisplayReport(user.id, {
      itemUrl: 'https://fake.url.com',
      pageId: page.id,
      reportComment: 'report comment',
      reportTypes: [ReportType.ContentDisplay],
    })
    expect(result).to.eql(true)
    const saved = await getRepository(ContentDisplayReport).findOneBy({
      user: { id: user.id },
      elasticPageId: page.id,
    })

    expect(saved?.reportComment).to.eql('report comment')
  })
})
