import { Story } from "../types";

export const mockStories: Story[] = [
  {
    id: "1",
    title: "The Brave Little Dragon Slayer",
    content: `Once upon a time, in a magical kingdom filled with sparkling towers and rainbow bridges, there lived a brave little hero named Emma. Emma was just 4 years old, but she had the biggest heart in all the kingdom.

One sunny morning, Emma woke up to find that a friendly dragon named Sparkles had gotten lost in the kingdom's enchanted forest. Sparkles wasn't scary at all - she had shimmering purple scales and loved to help people!

"Don't worry, Sparkles!" Emma said with a big smile. "I'll help you find your way home!"

Together, Emma and Sparkles went on an amazing adventure through the forest. They met talking rabbits who gave them directions, crossed a bridge made of flowers, and even found a treasure chest filled with golden cookies!

When they finally reached Sparkles' home in the Crystal Caves, the dragon's family was so happy. They thanked Emma by giving her a special necklace that glowed with magical light.

Emma returned home just in time for dinner, her heart full of joy from helping a new friend. She learned that being brave means being kind and helping others, even when things seem a little scary.

And that night, Emma fell asleep with the biggest smile, dreaming of more magical adventures to come.

The End.`,
    childName: "Emma",
    gender: "female",
    age: 4,
    purpose: "adventure",
    duration: 5,
    createdAt: new Date("2026-02-10"),
    rating: 4.8,
    ratingsCount: 234,
    chapters: [],
    tags: ["adventure", "dragons", "friendship", "bravery"],
    description: "A magical adventure story about a brave 4-year-old who helps a friendly dragon find her way home.",
    slug: "the-brave-little-dragon-slayer-mock1",
    imageUrl: "/images/mock/brave_dragon_slayer.png",
  },
  {
    id: "2",
    title: "Rey's Magical Tooth Brushing Adventure",
    content: `Rey was a wonderful 3-year-old with the most beautiful red hair that shined like copper in the sunlight. Every night before bed, Rey had a very important job to do - brushing her teeth!

But tonight was extra special. As Rey picked up her toothbrush, something magical happened! Tiny sparkles began to dance around the bathroom.

"Hello, Rey!" said a friendly voice. A tiny fairy appeared, no bigger than Rey's thumb, with wings that sparkled like her red hair. "I'm the Tooth Fairy's helper, and I'm here to show you something amazing!"

The fairy waved her wand, and Rey's toothbrush began to glow. "Every time you brush your teeth," the fairy explained, "you're protecting your teeth from tiny sugar bugs that try to make them sad."

Rey watched in wonder as the fairy showed her how to brush up and down, side to side, making sure to reach all her teeth. "You're doing great!" the fairy cheered.

When Rey finished brushing, her teeth sparkled so brightly that they lit up the whole bathroom! The fairy clapped her little hands with joy.

"Now your teeth are strong and healthy!" the fairy said. "Keep brushing twice every day, and your teeth will stay happy and bright forever!"

Rey smiled the biggest smile, showing off her clean, sparkling teeth. From that night on, brushing her teeth became her favorite part of bedtime.

The End.`,
    childName: "Rey",
    gender: "female",
    age: 3,
    purpose: "education",
    educationCategory: "Healthy Eating",
    additionalInfo: "Rey is a red head",
    duration: 3,
    createdAt: new Date("2026-02-15"),
    rating: 4.9,
    ratingsCount: 456,
    chapters: [],
    tags: ["education", "tooth brushing", "healthy habits", "fairy"],
    description: "An educational story teaching a 3-year-old red-haired girl about the importance of brushing teeth through a magical fairy adventure.",
    slug: "reys-magical-tooth-brushing-adventure-mock2",
    imageUrl: "/images/mock/tooth_brushing.png",
  },
  {
    id: "3",
    title: "The First Day Adventure",
    content: `Oliver was excited but also a little nervous. Today was his very first day of school! He held his mom Sarah's hand as they walked to the big red school building.

"What if I don't make any friends?" Oliver whispered.

Mom Sarah knelt down and gave him a warm hug. "You know what? Everyone feels that way on their first day. But you're kind, funny, and wonderful. You'll do great!"

Oliver took a deep breath and walked into his classroom. His teacher, Ms. Garcia, had a warm smile that made him feel safe.

"Welcome, Oliver!" she said. "Would you like to help me set up the building blocks?"

As Oliver started building a tower, another boy came over. "Can I help? I'm Lucas!"

Soon, Oliver and Lucas were building the tallest tower in the class together. Then a girl named Mia joined them, and they decided to build a whole castle!

By lunchtime, Oliver had made three new friends. They sat together, shared their crackers, and laughed at silly jokes.

When Mom Sarah picked him up, Oliver ran to her with the biggest smile. "Mom! School is amazing! Can I go back tomorrow?"

Mom Sarah hugged him tight. "Of course! I'm so proud of you for being brave."

Oliver learned that new things might feel scary at first, but they can turn into the best adventures!

The End.`,
    childName: "Oliver",
    gender: "male",
    age: 5,
    purpose: "education",
    educationCategory: "First Day of School",
    parentNames: [{ name: "Sarah", gender: "female" }],
    duration: 5,
    createdAt: new Date("2026-02-12"),
    rating: 4.7,
    ratingsCount: 189,
    chapters: [],
    tags: ["education", "first day of school", "friendship", "confidence"],
    description: "A heartwarming story about a 5-year-old's first day of school and making new friends.",
    slug: "the-first-day-adventure-mock3",
    imageUrl: "/images/mock/first_day.png",
  },
  {
    id: "4",
    title: "The Sharing Star",
    content: `Lily loved playing with her toys, especially her collection of colorful stuffed animals. She had bears, bunnies, and even a sparkly unicorn named Rainbow.

One day, Lily's little brother Max wanted to play with Rainbow. "No!" Lily said, hugging Rainbow tight. "She's mine!"

Max's eyes filled with tears, and he walked away sadly. Lily felt a strange feeling in her tummy - it didn't feel good.

That night, Lily's dad Tom told her a bedtime story about a little star in the sky who kept all her light to herself. The other stars felt sad, and the sky looked dark and lonely.

"But then," Dad Tom continued, "the little star decided to share her light with others. And guess what? When she shared, her light became even brighter! The whole sky sparkled, and she felt so happy!"

Lily thought about this. The next morning, she found Max and said, "Do you want to play with Rainbow together?"

Max's face lit up like sunshine! They played for hours, creating wonderful adventures with all the stuffed animals. They even let their dog Buddy join in!

Lily discovered something magical - when she shared, the fun became twice as big! Playing together was so much better than playing alone.

From that day on, Lily became the best at sharing. And you know what? She felt like the brightest star in the whole sky!

The End.`,
    childName: "Lily",
    gender: "female",
    age: 4,
    purpose: "education",
    educationCategory: "Sharing",
    siblings: [{ name: "Max", gender: "male" }],
    parentNames: [{ name: "Tom", gender: "male" }],
    petName: "Buddy",
    petType: "dog",
    duration: 5,
    createdAt: new Date("2026-02-14"),
    rating: 4.9,
    ratingsCount: 312,
    chapters: [],
    tags: ["education", "sharing", "siblings", "kindness"],
    description: "A touching story about a 4-year-old learning the joy of sharing with her brother.",
    slug: "the-sharing-star-mock4",
    imageUrl: "/images/mock/sharing_star.png",
  },
  {
    id: "5",
    title: "The Bedtime Monster",
    content: `Every night, Ethan felt scared when the lights went out. He was sure there were monsters hiding in his closet and under his bed.

"Mom! Dad!" Ethan would call. His parents, Jennifer and Mike, would come running.

One night, Dad Mike said, "I have an idea. Let's go on a monster hunt together!"

Ethan held his dad's hand tight as they checked the closet. "No monsters here," Dad said. "Just your clothes and toys!"

They looked under the bed. "No monsters here either," Mom Jennifer said. "Just some dust bunnies that tickle our noses!"

Then Mom had a brilliant idea. "You know what? Let's make this room a 'No Monster Zone!' Monsters are actually scared of brave kids like you!"

Together, they made a colorful sign that said "Ethan's Room - No Monsters Allowed! Guarded by the Bravest Kid!"

Dad Mike gave Ethan a special flashlight. "If you ever feel scared, you can use this. Light scares away any worries!"

That night, Ethan felt different. He looked at his sign and held his flashlight. He realized his room was actually very cozy and safe.

"Good night, Mom and Dad," Ethan said with a yawn. "I'm not scared anymore!"

As Ethan drifted off to sleep, he dreamed of being a superhero who protected other kids from feeling scared at bedtime.

The End.`,
    childName: "Ethan",
    gender: "male",
    age: 5,
    purpose: "education",
    educationCategory: "Bedtime Anxiety",
    parentNames: [{ name: "Jennifer", gender: "female" }, { name: "Mike", gender: "male" }],
    duration: 5,
    createdAt: new Date("2026-02-13"),
    rating: 4.8,
    ratingsCount: 267,
    chapters: [],
    tags: ["education", "bedtime", "anxiety", "fear", "family"],
    description: "A comforting story about a 5-year-old overcoming bedtime fears with the help of his parents.",
    slug: "the-bedtime-monster-mock5",
    imageUrl: "/images/mock/bedtime_monster.png",
  },
  {
    id: "6",
    title: "The Kindness Captain",
    content: `Sophia loved going to preschool, but one day she noticed something that made her sad. There was a new boy named Alex, and some kids were being mean to him because he wore glasses.

"Four eyes!" one kid laughed. Alex looked down at his shoes, trying not to cry.

Sophia remembered what her parents always told her: "Be kind, always." She walked right up to Alex with a big smile.

"Hi! I'm Sophia! Do you want to play blocks with me?" she asked.

Alex looked up, surprised. His face broke into a huge smile. "Really? Yes!"

As they played, Sophia told Alex, "I think your glasses are really cool! My dad wears glasses too, and he says they're like superpowers for seeing better!"

Alex giggled. "I never thought about it that way!"

Sophia then did something even braver. She stood up in front of the other kids and said, "Being different is what makes us special! Alex is my friend, and I think we should all be kind to each other."

The teacher, Ms. Rodriguez, smiled proudly. The other kids looked at each other and started to understand. One by one, they came over to apologize and ask Alex to play.

By the end of the day, Alex had made lots of new friends. He gave Sophia a big hug. "Thank you for being brave and kind!"

Sophia learned that standing up for others takes courage, but it's always the right thing to do. She became known as the "Kindness Captain" in her class!

The End.`,
    childName: "Sophia",
    gender: "female",
    age: 5,
    purpose: "education",
    educationCategory: "Bullying",
    duration: 5,
    createdAt: new Date("2026-02-11"),
    rating: 5.0,
    ratingsCount: 423,
    chapters: [],
    tags: ["education", "bullying", "kindness", "bravery", "friendship"],
    description: "An empowering story about a 5-year-old standing up against bullying and showing kindness.",
    slug: "the-kindness-captain-mock6",
    imageUrl: "/images/mock/kindness_captain.png",
  },
];
