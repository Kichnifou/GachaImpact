// @vitest-environment happy-dom
import {expect,it,vi} from 'vitest'
import {createGameApiClient} from './game-api'
it('sends monotone session-bound presence while polling remains a read without activity',async()=>{
 const fetchImplementation=vi.fn<typeof fetch>(async()=>new Response('{}'));const api=createGameApiClient({baseUrl:'https://api.example',getAccessToken:async()=>'synthetic-fixture',fetchImplementation}).sharedInvocations
 await api.control('tab','presence','invocation',undefined,'session');await api.control('tab','presence','other',undefined,'session');await api.state('tab','own:session:5')
 const first=JSON.parse(fetchImplementation.mock.calls[0]![1]!.body as string),second=JSON.parse(fetchImplementation.mock.calls[1]![1]!.body as string)
 expect(first).toMatchObject({sessionId:'session',screen:'invocation'});expect(second.presenceRevision).toBeGreaterThan(first.presenceRevision);expect(second.screen).toBe('other');expect(fetchImplementation.mock.calls[2]![0]).toContain('/state?tabId=tab&cursor=own%3Asession%3A5');expect(fetchImplementation.mock.calls[2]![1]!.body).toBeUndefined()
})
it('resumes the same committed intent through the original pull endpoint before reading its shared state',async()=>{
 const fetchImplementation=vi.fn<typeof fetch>(async()=>new Response('{}'));const api=createGameApiClient({baseUrl:'https://api.example',getAccessToken:async()=>'synthetic-fixture',fetchImplementation}).sharedInvocations
 await api.resume('tab',10,'original-intent')
 expect(fetchImplementation.mock.calls.map(c=>c[0])).toEqual(['https://api.example/api/v1/gacha/pull','https://api.example/api/v1/shared-invocations/state?tabId=tab'])
 expect(JSON.parse(fetchImplementation.mock.calls[0]![1]!.body as string)).toEqual({tabId:'tab',count:10,idempotencyKey:'original-intent'})
})
