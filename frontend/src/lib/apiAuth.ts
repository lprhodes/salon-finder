import { NextRequest, NextResponse } from 'next/server';
import { getSession } from './auth';

export async function withAuth(
  handler: (request: NextRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest) => {
    const session = await getSession();
    
    if (!session || !session.authenticated) {
      return NextResponse.json(
        { error: 'Unauthorized - Please login first' },
        { status: 401 }
      );
    }
    
    return handler(request);
  };
}