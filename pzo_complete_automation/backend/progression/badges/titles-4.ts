class Achievements {
title1 = 'The Beginner';
title2 = 'The Apprentice';
title3 = 'The Master';
title4 = 'The Legend';

getTitle(level: number): string {
if (level <= 5) {
return this.title1;
} else if (level <= 20) {
return this.title2;
} else if (level <= 50) {
return this.title3;
} else {
return this.title4;
}
}
}
