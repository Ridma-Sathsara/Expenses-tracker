package expo.modules.smsreader

import android.Manifest
import android.content.pm.PackageManager
import android.provider.Telephony
import androidx.core.content.ContextCompat
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Reads SMS messages from the phone's inbox so bank alerts can be turned into expenses.
 * Messages are only read on the device; nothing leaves the phone.
 */
class SmsReaderModule : Module() {
  private val context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("SmsReader")

    Function("hasPermission") {
      ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) ==
        PackageManager.PERMISSION_GRANTED
    }

    // Returns inbox messages received after `sinceMs` (newest first), at most `limit`.
    AsyncFunction("getInboxAsync") { sinceMs: Double, limit: Int ->
      if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) !=
        PackageManager.PERMISSION_GRANTED
      ) {
        throw Exceptions.MissingPermissions(Manifest.permission.READ_SMS)
      }

      val result = mutableListOf<Map<String, Any?>>()
      val projection = arrayOf(
        Telephony.Sms._ID,
        Telephony.Sms.ADDRESS,
        Telephony.Sms.BODY,
        Telephony.Sms.DATE,
      )
      context.contentResolver.query(
        Telephony.Sms.Inbox.CONTENT_URI,
        projection,
        "${Telephony.Sms.DATE} > ?",
        arrayOf(sinceMs.toLong().toString()),
        "${Telephony.Sms.DATE} DESC",
      )?.use { cursor ->
        val idCol = cursor.getColumnIndexOrThrow(Telephony.Sms._ID)
        val addressCol = cursor.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)
        val bodyCol = cursor.getColumnIndexOrThrow(Telephony.Sms.BODY)
        val dateCol = cursor.getColumnIndexOrThrow(Telephony.Sms.DATE)
        while (cursor.moveToNext() && result.size < limit) {
          result.add(
            mapOf(
              "id" to cursor.getLong(idCol).toString(),
              "address" to cursor.getString(addressCol),
              "body" to (cursor.getString(bodyCol) ?: ""),
              "date" to cursor.getLong(dateCol).toDouble(),
            )
          )
        }
      }
      result
    }
  }
}
