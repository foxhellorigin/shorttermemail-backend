import config from '../config/config.js';

class EmailGenerator {
  constructor() {
    this.adjectives = [
      'quick', 'lazy', 'happy', 'silly', 'clever', 'brave', 'calm', 'eager', 
      'fancy', 'gentle', 'jolly', 'kind', 'lucky', 'nice', 'proud', 'witty',
      'young', 'bold', 'cool', 'dear', 'fair', 'fine', 'grand', 'great',
      'happy', 'jolly', 'kind', 'lucky', 'merry', 'nice', 'proud', 'super'
    ];
    
    this.nouns = [
      'fox', 'dog', 'cat', 'bird', 'fish', 'lion', 'tiger', 'bear', 'wolf', 
      'eagle', 'hawk', 'frog', 'deer', 'duck', 'goose', 'swan', 'owl', 'bat',
      'puma', 'seal', 'whale', 'shark', 'horse', 'sheep', 'goat', 'cow', 'bull',
      'ant', 'bee', 'bug', 'fly', 'wasp', 'moth', 'worm', 'slug', 'snail'
    ];
    
    this.arabicAdjectives = [
      'سعيد', 'جميل', 'كبير', 'صغير', 'جديد', 'قديم', 'سريع', 'بطيء',
      'حلو', 'مر', 'خفيف', 'ثقيل', 'نظيف', 'وسخ', 'غني', 'فقير',
      'قوي', 'ضعيف', 'طويل', 'قصير', 'عريض', 'ضيق', 'ساخن', 'بارد'
    ];
    
    this.arabicNouns = [
      'قمر', 'شمس', 'نجم', 'بحر', 'نهر', 'جبل', 'وادي', 'صحراء',
      'زهرة', 'شجرة', 'وردة', 'ثمرة', 'كتاب', 'قلم', 'ورقة', 'مكتب',
      'بيت', 'باب', 'نافذة', 'سقف', 'جدار', 'ارض', 'سطح', 'حديقة'
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
    const length = 8 + Math.floor(Math.random() * 6); // 8-13 characters
    
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

  generateArabicEmail() {
    const adjective = this.arabicAdjectives[Math.floor(Math.random() * this.arabicAdjectives.length)];
    const noun = this.arabicNouns[Math.floor(Math.random() * this.arabicNouns.length)];
    const number = Math.floor(Math.random() * 999);
    const domain = this.domains[Math.floor(Math.random() * this.domains.length)];
    
    // Convert Arabic to English characters for email compatibility
    const arabicToEnglish = {
      'سعيد': 'saeed', 'جميل': 'jameel', 'كبير': 'kabeer', 'صغير': 'sagheer',
      'قمر': 'qamar', 'شمس': 'shams', 'نجم': 'najm', 'بحر': 'bahr'
    };
    
    const adjEng = arabicToEnglish[adjective] || adjective;
    const nounEng = arabicToEnglish[noun] || noun;
    
    return `${adjEng}${nounEng}${number}@${domain}`;
  }

  generateCustomEmail(customPart) {
    const domain = this.domains[Math.floor(Math.random() * this.domains.length)];
    return `${customPart}@${domain}`;
  }

  // Generate multiple emails at once
  generateMultipleEmails(count = 5, type = 'random') {
    const emails = [];
    for (let i = 0; i < count; i++) {
      let email;
      switch (type) {
        case 'pronounceable':
          email = this.generatePronounceableEmail();
          break;
        case 'arabic':
          email = this.generateArabicEmail();
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

  // Validate if an email belongs to our service
  isValidServiceEmail(email) {
    if (!email || typeof email !== 'string') return false;
    return this.domains.some(domain => email.toLowerCase().endsWith(domain));
  }

  // Get domain from email
  getDomainFromEmail(email) {
    if (!this.isValidServiceEmail(email)) return null;
    const parts = email.split('@');
    return parts.length === 2 ? parts[1] : null;
  }

  // Get stats about email generation
  getStats() {
    return {
      totalAdjectives: this.adjectives.length,
      totalNouns: this.nouns.length,
      totalArabicAdjectives: this.arabicAdjectives.length,
      totalArabicNouns: this.arabicNouns.length,
      availableDomains: this.domains,
      generationMethods: ['random', 'pronounceable', 'arabic', 'custom']
    };
  }
}

export default new EmailGenerator();

// Named exports for individual functions
export const { 
  generateRandomEmail, 
  generatePronounceableEmail, 
  generateArabicEmail,
  generateCustomEmail,
  generateMultipleEmails,
  isValidServiceEmail,
  getDomainFromEmail,
  getStats
} = EmailGenerator.prototype;