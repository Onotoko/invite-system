describe('Custom Base31 Generator', () => {
    let generator;

    beforeEach(() => {
        // Set test environment variables
        process.env.INVITE_ALPHABET = 'K7Q2N5XR8BMVY9CW3PFGJH6DZT4SL';
        process.env.SYSTEM_SALT = 'TestSalt2024';

        // Clear module cache to reload with new env vars
        jest.resetModules();

        // Require the service fresh
        const service = require('../../src/services/invite.service');
        generator = service.codeGenerator;
    });

    describe('Code Generation', () => {
        test('should generate code in format XXXX-XXXX', () => {
            const code = generator.generate();
            expect(code).toMatch(/^[K7Q2N5XR8BMVY9CW3PFGJH6DZT4SL]{4}-[K7Q2N5XR8BMVY9CW3PFGJH6DZT4SL]{4}$/);
            expect(code.length).toBe(9); // 4 + 1 (dash) + 4
        });

        test('should generate unique codes', () => {
            const codes = new Set();
            for (let i = 0; i < 1000; i++) {
                codes.add(generator.generate());
            }
            expect(codes.size).toBe(1000);
        });

        test('should use only allowed characters', () => {
            const alphabet = 'K7Q2N5XR8BMVY9CW3PFGJH6DZT4SL';
            for (let i = 0; i < 100; i++) {
                const code = generator.generate().replace('-', '');
                for (let char of code) {
                    expect(alphabet.includes(char)).toBe(true);
                }
            }
        });

        test('should have checksum at position 4', () => {
            const code = generator.generate();
            const clean = code.replace('-', '');

            // Extract the checksum (position 4, index 3)
            const checksum = clean[3];

            // Reconstruct original 7 chars
            const original = clean.slice(0, 3) + clean.slice(4);

            // Verify checksum
            const expectedChecksum = generator.calculateChecksum(original);
            expect(checksum).toBe(expectedChecksum);
        });
    });

    describe('Checksum Validation', () => {
        test('should validate generated codes', () => {
            for (let i = 0; i < 100; i++) {
                const code = generator.generate();
                expect(generator.validate(code)).toBe(true);
            }
        });

        test('should reject code with wrong checksum', () => {
            const code = generator.generate();
            // Change checksum character (first character after dash)
            const parts = code.split('-');
            const corrupted = parts[0].slice(0, 3) + 'X' + '-' + parts[1];
            expect(generator.validate(corrupted)).toBe(false);
        });

        test('should reject code with invalid characters', () => {
            expect(generator.validate('ABCD-EFGH')).toBe(false); // Invalid chars
            expect(generator.validate('1234-5678')).toBe(false); // Numbers not in alphabet
            expect(generator.validate('K7Q2-N5XO')).toBe(false); // O is not in alphabet
        });

        test('should reject code with wrong length', () => {
            expect(generator.validate('K7Q-2N5')).toBe(false);   // Too short
            expect(generator.validate('K7Q2N-5XR8')).toBe(false); // Wrong format
            expect(generator.validate('K7Q2-N5XR8')).toBe(false); // Too long
        });

        test('should handle codes without dash', () => {
            const code = generator.generate();
            const noDash = code.replace('-', '');
            expect(generator.validate(noDash)).toBe(true);
        });

        test('should handle lowercase codes', () => {
            const code = generator.generate();
            const lowercase = code.toLowerCase();
            expect(generator.validate(lowercase)).toBe(true);
        });
    });

    describe('Checksum Algorithm', () => {
        test('checksum should be deterministic', () => {
            const str = 'K7Q2N5X'; // 7 characters
            const checksum1 = generator.calculateChecksum(str);
            const checksum2 = generator.calculateChecksum(str);
            expect(checksum1).toBe(checksum2);
        });

        test('different inputs should produce different checksums', () => {
            const checksums = new Set();
            const alphabet = 'K7Q2N5XR8BMVY9CW3PFGJH6DZT4SL';

            for (let i = 0; i < 100; i++) {
                let str = '';
                for (let j = 0; j < 7; j++) {
                    str += alphabet[Math.floor(Math.random() * alphabet.length)];
                }
                checksums.add(generator.calculateChecksum(str));
            }

            // Should have high variation in checksums (at least 20 different values out of 100)
            expect(checksums.size).toBeGreaterThan(20);
        });

        test('checksum should use system salt', () => {
            const str = 'K7Q2N5X';

            // Save original salt
            const originalSalt = generator.salt;

            // Calculate with original salt
            const checksum1 = generator.calculateChecksum(str);

            // Change salt
            generator.salt = 'DifferentSalt';
            const checksum2 = generator.calculateChecksum(str);

            // Restore salt
            generator.salt = originalSalt;

            // Checksums should be different with different salts
            expect(checksum1).not.toBe(checksum2);
        });
    });

    describe('Format Function', () => {
        test('should format code correctly', () => {
            expect(generator.format('K7Q2N5XR')).toBe('K7Q2-N5XR');
            expect(generator.format('K7Q2-N5XR')).toBe('K7Q2-N5XR');
            expect(generator.format('k7q2n5xr')).toBe('K7Q2-N5XR'); // Should uppercase
        });

        test('should handle invalid lengths gracefully', () => {
            expect(generator.format('K7Q')).toBe('K7Q'); // Too short
            expect(generator.format('K7Q2N5XR8B')).toBe('K7Q2N5XR8B'); // Too long
        });
    });

    describe('Environment Configuration', () => {
        test('should use custom alphabet from environment', () => {
            process.env.INVITE_ALPHABET = '9PFGJH6DZT4SLK7Q2N5XR8BMVYCW3';

            jest.resetModules();
            const newService = require('../../src/services/invite.service');
            const newGenerator = newService.codeGenerator;

            expect(newGenerator.alphabet).toBe('9PFGJH6DZT4SLK7Q2N5XR8BMVYCW3');
        });

        test('should use custom salt from environment', () => {
            process.env.SYSTEM_SALT = 'MyCompany2024';

            jest.resetModules();
            const newService = require('../../src/services/invite.service');
            const newGenerator = newService.codeGenerator;

            expect(newGenerator.salt).toBe('MyCompany2024');
        });
    });
});