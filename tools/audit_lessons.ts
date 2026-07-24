
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../website/.env') });

import { supabase } from '../server/supabase';

async function auditLessons() {
    console.log("Auditing lessons...");

    // 1. Fetch all creations of type 'lesson'
    const { data: creations, error: creationsError } = await supabase
        .from('creations')
        .select('id, title, image_url, created_at')
        .eq('type', 'lesson');

    if (creationsError) {
        console.error("Error fetching creations:", creationsError);
        return;
    }

    // 2. Fetch all creation_tags to check for tags
    const { data: tagLinks, error: tagsError } = await supabase
        .from('creation_tags')
        .select('creation_id');

    if (tagsError) {
        console.error("Error fetching tags:", tagsError);
        return;
    }

    const idsWithTags = new Set(tagLinks.map(t => t.creation_id));

    console.log(`Found ${creations.length} lessons.`);
    console.log("-----------------------------------------");

    const toDelete: any[] = [];

    for (const creation of creations) {
        const hasImage = !!creation.image_url;
        const hasTags = idsWithTags.has(creation.id);

        console.log(`ID: ${creation.id} | Title: "${creation.title}" | Has Image: ${hasImage} | Has Tags: ${hasTags} | Created: ${creation.created_at}`);

        if (!hasImage || !hasTags) {
            toDelete.push(creation);
        }
    }

    console.log("-----------------------------------------");
    console.log(`Found ${toDelete.length} lessons to delete (No Image or No Tags).`);
    for (const lesson of toDelete) {
        console.log(`- ${lesson.title} (${lesson.id})`);
    }
}

auditLessons();
