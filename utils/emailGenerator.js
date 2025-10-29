import config from '../config/config.js';

class EmailGenerator {
    constructor() {
        this.adjectives = [
            'quick', 'lazy', 'happy', 'silly', 'clever', 'brave', 'calm', 'eager', 
            'fancy', 'gentle', 'jolly', 'kind', 'lucky', 'nice', 'proud', 'witty',
            'young', 'bold', 'cool', 'dear', 'fair', 'fine', 'grand', 'great',
            'happy', 'jolly', 'kind', 'lucky', 'nice', 'proud', 'silly', 'witty'
        ];
        
        this.nouns = [
            'fox', 'dog', 'cat', 'bird', 'fish', 'lion', 'tiger', 'bear', 'wolf', 
            'eagle', 'hawk', 'frog', 'deer', 'duck', 'goose', 'swan', 'owl', 'bat',
            'puma', 'seal', 'whale', 'shark', 'horse', 'sheep', 'goat', 'cow', 'bull',
            'rabbit', 'mouse', 'snake', 'turtle', 'monkey', 'panda', 'koala', 'zebra'
        ];
        
        this.domains = config.email.allowedDomains;
    }

    generateRandomEmail() {
        const adjective = this.adjectives[Math.floor(Math.random() * this.adjectives.length)];
        const noun = this.nouns[Math.floor(Math.random() * this.nouns.length)];
        const number = Math.floor(Math.random() * 9999);
        const domain = this.domains[Math.floor(Math.random() * this.domains.length)];
        
        return `${adjective}${noun}${number}@${domain}`;
    }

    generatePronounceableEmail() {
        const vowels = 'aeiou';
        const consonants = 'bcdfghjklmnpqrstvwxyz';
        
        let username = '';
        const length = 8 + Math.floor(Math.random() * 6);
        
        for (let i = 0; i < length; i++) {
            if (i % 2 === 0) {
                username += consonants[Math.floor(Math.random() * consonants.length)];
            } else {
                username += vowels[Math.floor(Math.random() * vowels.length)];
            }
        }
        
        const domain = this.domains[Math.floor(Math.random() * this.domains.length)];
        return `${username}@${domain}`;
    }

    generateCustomEmail(customPart) {
        const domain = this.domains[Math.floor(Math.random() * this.domains.length)];
        return `${customPart}@${domain}`;
    }

    generateMultipleEmails(count = 5, type = 'random') {
        const emails = [];
        for (let i = 0; i < count; i++) {
            let email;
            switch (type) {
                case 'pronounceable':
                    email = this.generatePronounceableEmail();
                    break;
                case 'random':
                default:
                    email = this.generateRandomEmail();
                    break;
            }
            emails.push(email);
        }
        return emails;
    }

    isValidServiceEmail(email) {
        return this.domains.some(domain => email.endsWith(domain));
    }
}

const emailGenerator = new EmailGenerator();
export default emailGenerator;

// Export individual functions for backward compatibility
export const generateRandomEmail = () => emailGenerator.generateRandomEmail();
export const generatePronounceableEmail = () => emailGenerator.generatePronounceableEmail();