import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from website/.env
dotenv.config({ path: path.resolve(__dirname, '../website/.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;

if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
    console.error('Missing environment variables. Check website/.env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const openai = new OpenAI({ apiKey: openaiApiKey });

async function fixMissingImages() {
    console.log('🚀 Starting Image Fixer Tool...');

    // 1. Fetch creations with missing image_url
    const { data: creations, error: fetchError } = await supabase
        .from('creations')
        .select('id, title, description, type, slug')
        .or('image_url.is.null,image_url.eq.""');

    if (fetchError) {
        console.error('❌ Failed to fetch creations:', fetchError);
        return;
    }

    if (!creations || creations.length === 0) {
        console.log('✅ No creations found missing images.');
        return;
    }

    console.log(`🔍 Found ${creations.length} creations missing images.`);

    const fixedItems = [];

    for (const creation of creations) {
        try {
            console.log(`🎨 Processing [${creation.type}] "${creation.title}" (${creation.id})...`);

            const prompt = `A whimsical, high-quality digital illustration for children titled '${creation.title}'. ${creation.description}. Magical, vibrant, safe for kids, dream-like atmosphere. IMPORTANT: The image must NOT contain any text, words, signatures, or characters. The illustration should be visual only.`;

            // 2. Generate Image
            const response = await openai.images.generate({
                model: "dall-e-3",
                prompt: prompt,
                n: 1,
                size: "1024x1024",
                quality: "standard",
                style: "vivid"
            });

            const tempImageUrl = response.data?.[0]?.url;
            if (!tempImageUrl) throw new Error("No image URL returned from OpenAI");

            // 3. Download from OpenAI
            const imgResponse = await fetch(tempImageUrl);
            if (!imgResponse.ok) throw new Error(`Failed to download image: ${imgResponse.statusText}`);
            const buffer = Buffer.from(await imgResponse.arrayBuffer());

            // 4. Upload to Supabase Storage
            const fileName = `${creation.id}/${Date.now()}.png`;
            const { error: uploadError } = await supabase.storage
                .from('creations')
                .upload(fileName, buffer, {
                    contentType: 'image/png',
                    upsert: true
                });

            if (uploadError) throw uploadError;

            // 5. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('creations')
                .getPublicUrl(fileName);

            // 6. Update Database
            const { error: updateError } = await supabase
                .from('creations')
                .update({ image_url: publicUrl })
                .eq('id', creation.id);

            if (updateError) throw updateError;

            console.log(`✅ Fixed: ${creation.title}`);
            fixedItems.push({
                title: creation.title,
                type: creation.type,
                url: `http://localhost:5173/${creation.type}/${creation.slug}`
            });

        } catch (err) {
            console.error(`❌ Failed to fix "${creation.title}":`, err instanceof Error ? err.message : err);
        }
    }

    // 7. Final Report
    console.log('\n--- 🏁 Final Report ---');
    if (fixedItems.length > 0) {
        console.log(`Successfully fixed ${fixedItems.length} items:\n`);
        fixedItems.forEach(item => {
            console.log(`- [${item.type}] ${item.title}: ${item.url}`);
        });
    } else {
        console.log('No items were fixed.');
    }
}

fixMissingImages();
