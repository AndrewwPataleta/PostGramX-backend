import {Test} from '@nestjs/testing';
import {AppModule} from '../../app.module';
import {DealsBotHandler} from './deals-bot.handler';

describe('DealsBotHandler DI', () => {
    it('resolves in AppModule', async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        expect(moduleRef.get(DealsBotHandler)).toBeDefined();

        await moduleRef.close();
    });
});
