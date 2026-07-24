console.log("--- Cleanup script starting ---");
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../website/.env') });

import { supabase } from '../server/supabase';

async function listAndCleanupLessons() {
    console.log("Fetching lessons...");

    // 1. Fetch all creations with their metadata
    const { data: creations, error: creationsError } = await supabase
        .from('creations')
        .select('*')
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

    const idsToDelete: string[] = [];
    const lessonsToDeleteInfo: string[] = [];

    for (const creation of creations) {
        const hasImage = !!creation.image_url;
        const hasTags = idsWithTags.has(creation.id);

        console.log(`ID: ${creation.id} | Title: "${creation.title}" | Has Image: ${hasImage} | Has Tags: ${hasTags} | Created: ${creation.created_at}`);

        if (!hasImage || !hasTags) {
            idsToDelete.push(creation.id);
            lessonsToDeleteInfo.push(`"${creation.title}" (${creation.id}) [Missing: ${!hasImage ? 'Image' : ''}${!hasImage && !hasTags ? ' & ' : ''}${!hasTags ? 'Tags' : ''}]`);
        }
    }

    console.log("-----------------------------------------");
    if (idsToDelete.length === 0) {
        console.log("No lessons found to delete.");
        return;
    }

    console.log(`Deleting ${idsToDelete.length} lessons...`);
    for (const info of lessonsToDeleteInfo) {
        console.log(`- Deleting: ${info}`);
    }

    // Since 'creations' table has ON DELETE CASCADE for associated tables (lessons, creation_tags, assets),
    // deleting from 'creations' should be enough.
    const { error: deleteError } = await supabase
        .from('creations')
        .delete()
        .in('id', idsToDelete);

    if (deleteError) {
        console.error("Error deleting lessons:", deleteError);
    } else {
        console.log("Successfully deleted selected lessons.");
    }
}

listAndCleanupLessons().then(() => {
    console.log("--- Cleanup script finished ---");
    process.exit(0);
}).catch(err => {
    console.error("--- Cleanup script failed ---", err);
    process.exit(1);
});
