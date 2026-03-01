import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { NostrJwtAuthGuard } from '../auth/nostr-jwt-auth.guard';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';
import { BooksService } from './books.service';

@ApiTags('books')
@Controller('api/v1/books')
@UseGuards(NostrJwtAuthGuard)
@ApiBearerAuth()
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  @Post()
  create(@CurrentUser() pubkey: string, @Body() dto: CreateBookDto) {
    return this.booksService.create(pubkey, dto);
  }

  @Get()
  listMine(@CurrentUser() pubkey: string) {
    return this.booksService.listMine(pubkey);
  }

  @Get(':bookId')
  get(@CurrentUser() pubkey: string, @Param('bookId') bookId: string) {
    return this.booksService.get(pubkey, bookId);
  }

  @Patch(':bookId')
  update(@CurrentUser() pubkey: string, @Param('bookId') bookId: string, @Body() dto: UpdateBookDto) {
    return this.booksService.update(pubkey, bookId, dto);
  }

  @Delete(':bookId')
  remove(@CurrentUser() pubkey: string, @Param('bookId') bookId: string) {
    return this.booksService.remove(pubkey, bookId);
  }

  @Post(':bookId/chapters')
  createChapter(@CurrentUser() pubkey: string, @Param('bookId') bookId: string, @Body() dto: CreateChapterDto) {
    return this.booksService.addChapter(pubkey, bookId, dto);
  }

  @Patch(':bookId/chapters/:chapterId')
  updateChapter(
    @CurrentUser() pubkey: string,
    @Param('bookId') bookId: string,
    @Param('chapterId') chapterId: string,
    @Body() dto: UpdateChapterDto,
  ) {
    return this.booksService.updateChapter(pubkey, bookId, chapterId, dto);
  }

  @Delete(':bookId/chapters/:chapterId')
  removeChapter(@CurrentUser() pubkey: string, @Param('bookId') bookId: string, @Param('chapterId') chapterId: string) {
    return this.booksService.removeChapter(pubkey, bookId, chapterId);
  }

  @Post(':bookId/publish')
  publish(@CurrentUser() pubkey: string, @Param('bookId') bookId: string) {
    return this.booksService.publish(pubkey, bookId);
  }

  @Get(':bookId/export')
  exportBook(@CurrentUser() pubkey: string, @Param('bookId') bookId: string, @Query('format') format: 'pdf' | 'epub') {
    return this.booksService.export(pubkey, bookId, format);
  }

  @Get(':bookId/sales')
  sales(@CurrentUser() pubkey: string, @Param('bookId') bookId: string) {
    return this.booksService.salesDashboard(pubkey, bookId);
  }
}
