const request = require('supertest');
const app = require('../../src/app');
const Invite = require('../../src/models/invite.model');
const inviteService = require('../../src/services/invite.service');

describe('Invite Code System', () => {

    beforeEach(async () => {
        await Invite.deleteMany({});
    });

    describe('Code Generation', () => {
        test('should generate 8 character code', () => {
            const code = inviteService.generateCode();
            expect(code).toHaveLength(8);
        });

        test('should not contain confusing characters', () => {
            const code = inviteService.generateCode();
            expect(code).not.toMatch(/[01OIl]/);
        });

        test('should generate unique codes', () => {
            const codes = new Set();
            for (let i = 0; i < 100; i++) {
                codes.add(inviteService.generateCode());
            }
            expect(codes.size).toBe(100);
        });
    });

    describe('Create Invite', () => {
        test('should create single-use invite', async () => {
            const invite = await inviteService.createInvite('admin@test.com', 1);

            expect(invite.code).toHaveLength(8);
            expect(invite.maxUses).toBe(1);
            expect(invite.currentUses).toBe(0);
            expect(invite.referrerEmail).toBe('admin@test.com');
        });

        test('should create multi-use invite', async () => {
            const invite = await inviteService.createInvite('admin@test.com', 5);

            expect(invite.maxUses).toBe(5);
            expect(invite.isActive).toBe(true);
        });
    });

    describe('Use Invite', () => {
        test('should use valid invite code', async () => {
            const invite = await inviteService.createInvite('admin@test.com', 1);

            const result = await inviteService.useInvite(
                invite.code,
                'user@test.com',
                '127.0.0.1'
            );

            expect(result.currentUses).toBe(1);
            expect(result.usedBy[0].email).toBe('user@test.com');
        });

        test('should reject expired invite', async () => {
            const invite = await inviteService.createInvite('admin@test.com', 1, -1);

            await expect(
                inviteService.useInvite(invite.code, 'user@test.com', '127.0.0.1')
            ).rejects.toThrow('expired');
        });

        test('should reject max used invite', async () => {
            const invite = await inviteService.createInvite('admin@test.com', 1);

            await inviteService.useInvite(invite.code, 'user1@test.com', '127.0.0.1');

            await expect(
                inviteService.useInvite(invite.code, 'user2@test.com', '127.0.0.1')
            ).rejects.toThrow('max uses');
        });

        test('should prevent email reuse', async () => {
            const invite1 = await inviteService.createInvite('admin@test.com', 1);
            const invite2 = await inviteService.createInvite('admin@test.com', 1);

            await inviteService.useInvite(invite1.code, 'user@test.com', '127.0.0.1');

            await expect(
                inviteService.useInvite(invite2.code, 'user@test.com', '127.0.0.1')
            ).rejects.toThrow('already used');
        });
    });

    describe('Concurrency', () => {
        test('should handle concurrent requests', async () => {
            const invite = await inviteService.createInvite('admin@test.com', 2);

            const promises = [];
            for (let i = 0; i < 5; i++) {
                promises.push(
                    inviteService.useInvite(
                        invite.code,
                        `user${i}@test.com`,
                        '127.0.0.1'
                    ).catch(e => e.message)
                );
            }

            const results = await Promise.all(promises);
            const successes = results.filter(r => typeof r === 'object').length;
            const failures = results.filter(r => typeof r === 'string').length;

            expect(successes).toBe(2);
            expect(failures).toBe(3);
        });
    });

    describe('API Endpoints', () => {
        test('POST /api/invite/use', async () => {
            const invite = await inviteService.createInvite('admin@test.com', 1);

            const response = await request(app)
                .post('/api/invite/use')
                .send({
                    code: invite.code,
                    email: 'user@test.com'
                });

            expect(response.status).toBe(200);
            expect(response.body.data.success).toBe(true);
        });

        test('GET /api/invite/validate/:code', async () => {
            const invite = await inviteService.createInvite('admin@test.com', 1);

            const response = await request(app)
                .get(`/api/invite/validate/${invite.code}`);

            expect(response.status).toBe(200);
            expect(response.body.data.valid).toBe(true);
            expect(response.body.data.remainingUses).toBe(1);
        });
    });
});