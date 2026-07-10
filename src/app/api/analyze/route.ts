import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { verifyTelegramAuth } from '@/lib/server/telegram-auth';
import { AIService } from '@/lib/server/ai-service';
import { getStorageAdapter } from '@/lib/server/storage';

// Initialize the AI service singleton
const aiService = new AIService();

export async function POST(request: Request) {
  try {
    // 1. Verify Telegram authentication header
    const initDataRaw = request.headers.get('x-telegram-init-data');
    if (!initDataRaw) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const tgUser = verifyTelegramAuth(initDataRaw);
    const userId = String(tgUser.id);

    // 2. Fetch user settings for preferred AI provider
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { settings: true },
    });

    const provider = (user?.settings?.preferredAiProvider as 'gemini' | 'openai') || 'gemini';

    // 3. Parse FormData payload
    const formData = await request.formData();
    const text = formData.get('text') as string | null;
    const imageFile = formData.get('image') as File | null;
    const voiceFile = formData.get('voice') as File | null;

    let imageBuffer: Buffer | undefined;
    let imageMimeType: string | undefined;
    let uploadedPhotoId: string | undefined;

    // 4. Handle Image Upload & Storage Ingestion
    if (imageFile && imageFile.size > 0) {
      imageMimeType = imageFile.type;
      const arrayBuffer = await imageFile.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);

      console.log(`📸 Image received: ${imageFile.name} (${imageFile.size} bytes)`);

      // Upload via storage adapter
      const storage = getStorageAdapter();
      const uploadResult = await storage.uploadFile(imageBuffer, imageMimeType, imageFile.name);

      // Save photo CDN metadata to Database
      const mealPhoto = await prisma.mealPhoto.create({
        data: {
          userId,
          url: uploadResult.url,
          storagePath: uploadResult.storagePath,
        },
      });
      uploadedPhotoId = mealPhoto.id;
    }

    // 5. Handle Voice Message Ingestion
    let voiceBuffer: Buffer | undefined;
    let voiceMimeType: string | undefined;

    if (voiceFile && voiceFile.size > 0) {
      voiceMimeType = voiceFile.type;
      const arrayBuffer = await voiceFile.arrayBuffer();
      voiceBuffer = Buffer.from(arrayBuffer);
      console.log(`🎙️ Voice audio received: ${voiceFile.name} (${voiceFile.size} bytes)`);
    }

    if (!text && !imageBuffer && !voiceBuffer) {
      return NextResponse.json({ success: false, error: 'No food description, photo, or audio uploaded' }, { status: 400 });
    }

    // 6. Run Multi-modal AI Food Analysis
    console.log(`🤖 Starting AI analysis using provider: ${provider}...`);
    const analysisResult = await aiService.analyzeFood(
      {
        text: text || undefined,
        imageBuffer,
        imageMimeType,
        voiceBuffer,
        voiceMimeType,
      },
      provider
    );

    // 7. Log AI Analysis into DB
    const promptString = [
      text ? `Text: ${text}` : '',
      imageFile ? `Image: ${imageFile.name}` : '',
      voiceFile ? `Voice: ${voiceFile.name}` : '',
    ]
      .filter(Boolean)
      .join(' | ');

    await prisma.aIAnalysis.create({
      data: {
        userId,
        prompt: promptString,
        responseRaw: JSON.stringify(analysisResult),
        confidence: analysisResult.confidence,
        success: !analysisResult.ai_notes.includes('⚠️'),
        errorLog: analysisResult.ai_notes.includes('⚠️') ? analysisResult.ai_notes : null,
      },
    });

    // 8. Return results
    return NextResponse.json({
      success: true,
      analysis: analysisResult,
      photoId: uploadedPhotoId, // Return photo ID so the client can link it on confirmation
      photoUrl: uploadedPhotoId ? (await prisma.mealPhoto.findUnique({ where: { id: uploadedPhotoId } }))?.url : null,
    });

  } catch (error: any) {
    console.error('🔴 [ANALYZE-POST] Food analysis API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: error.message?.includes('signature') ? 401 : 500 }
    );
  }
}
